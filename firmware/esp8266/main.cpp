#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

// -------------------- RFID PINS --------------------

#define RFID_SS_PIN D8
#define RFID_RST_PIN D3

// -------------------- RELAY CONFIGURATION --------------------

#define RELAY_PIN D1

const uint8_t RELAY_ACTIVE_LEVEL = LOW;
const uint8_t RELAY_LOCKED_LEVEL = HIGH;

const unsigned long UNLOCK_DURATION = 3000;

// Centralized Relay State Machine
enum RelayControlState {
    RELAY_STATE_LOCKED,
    RELAY_STATE_UNLOCKED_RFID,
    RELAY_STATE_UNLOCKED_ADMIN
};

RelayControlState currentRelayState = RELAY_STATE_LOCKED;
unsigned long relayUnlockStartTime = 0;
unsigned long relayUnlockDuration = 3000;

// -------------------- WIFI --------------------

const char* WIFI_SSID = "POCO M3";
const char* WIFI_PASSWORD = "pavangowda";

// -------------------- BACKEND --------------------

const char* BACKEND_BASE_URL = "http://192.168.43.95:5000/api";
const char* API_URL = "http://192.168.43.95:5000/api/access/verify";

const char* DEVICE_API_KEY = "81f6abd1a88ce3ff079022b8aed06eef52308b4a10eb493dfbda03c94296ff9c";

const char* DEVICE_ID = "door-lock-01";

// -------------------- OBJECTS & TIMING --------------------

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);

unsigned long lastReconnectAttempt = 0;
const unsigned long RECONNECT_INTERVAL = 10000;

// Polling interval for remote enrollment mode (1.5 seconds)
unsigned long lastEnrollmentPoll = 0;
const unsigned long ENROLLMENT_POLL_INTERVAL = 1500;

// Polling interval for remote door commands (1.5 seconds)
unsigned long lastCommandPoll = 0;
const unsigned long COMMAND_POLL_INTERVAL = 1500;

bool isEnrollmentMode = false;
String activeEnrollmentId = "";

// -------------------- WIFI --------------------

void connectWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    Serial.print("Connecting to WiFi");

    unsigned long startTime = millis();

    while (WiFi.status() != WL_CONNECTED &&
           millis() - startTime < 15000) {
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("ESP8266 IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi connection failed!");
    }
}

void maintainWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        return;
    }

    if (millis() - lastReconnectAttempt >= RECONNECT_INTERVAL) {
        lastReconnectAttempt = millis();

        Serial.println("WiFi disconnected. Reconnecting...");
        WiFi.reconnect();
    }
}

// -------------------- NON-BLOCKING RELAY CONTROL --------------------

/**
 * Handles automatic timer expiration for active unlock pulses.
 * Allows non-blocking operation without halting loop() or HTTP polling.
 */
void updateRelayState() {
    if (currentRelayState != RELAY_STATE_LOCKED) {
        if (millis() - relayUnlockStartTime >= relayUnlockDuration) {
            digitalWrite(RELAY_PIN, RELAY_LOCKED_LEVEL);
            currentRelayState = RELAY_STATE_LOCKED;
            Serial.println("[DOOR] Unlock duration elapsed. Relay locked.");
        }
    }
}

// -------------------- UID CONVERSION --------------------

String getUID() {
    String uid = "";

    for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) {
            uid += "0";
        }

        uid += String(rfid.uid.uidByte[i], HEX);
    }

    uid.toUpperCase();

    return uid;
}

// -------------------- BACKEND ACCESS VERIFICATION --------------------

bool verifyAccess(const String& uid) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Cannot verify: WiFi unavailable.");
        return false;
    }

    WiFiClient client;
    HTTPClient http;

    if (!http.begin(client, API_URL)) {
        Serial.println("HTTP initialization failed.");
        return false;
    }

    http.setTimeout(5000);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);
    http.addHeader("x-device-api-key", DEVICE_API_KEY);
    http.addHeader("x-api-key", DEVICE_API_KEY);

    JsonDocument request;
    request["uid"] = uid;
    request["deviceId"] = DEVICE_ID;

    String payload;
    serializeJson(request, payload);

    Serial.println("Sending verification request...");

    int httpCode = http.POST(payload);

    if (httpCode != HTTP_CODE_OK) {
        Serial.print("Backend HTTP error: ");
        Serial.println(httpCode);

        http.end();
        return false;
    }

    String response = http.getString();

    Serial.print("Backend response: ");
    Serial.println(response);

    JsonDocument result;
    DeserializationError error = deserializeJson(result, response);

    if (error) {
        Serial.println("Invalid backend JSON response.");
        http.end();
        return false;
    }

    bool authorized = result["authorized"] | false;

    http.end();

    return authorized;
}

// -------------------- REMOTE DOOR COMMANDS --------------------

/**
 * Acknowledges command execution back to the backend.
 */
void ackDoorCommand(const String& commandId, const String& status, const String& message = "") {
    if (WiFi.status() != WL_CONNECTED) {
        return;
    }

    WiFiClient client;
    HTTPClient http;
    String url = String(BACKEND_BASE_URL) + "/door/commands/" + commandId + "/ack";

    if (!http.begin(client, url)) {
        return;
    }

    http.setTimeout(3000);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);
    http.addHeader("x-device-api-key", DEVICE_API_KEY);
    http.addHeader("x-api-key", DEVICE_API_KEY);

    JsonDocument request;
    request["deviceId"] = DEVICE_ID;
    request["status"] = status;
    if (message.length() > 0) {
        request["message"] = message;
    }

    String payload;
    serializeJson(request, payload);

    http.POST(payload);
    http.end();
}

/**
 * Polls the backend for remote door control commands (unlock / lock) from the admin dashboard.
 */
void checkDoorCommands() {
    if (WiFi.status() != WL_CONNECTED) {
        return;
    }

    unsigned long currentMillis = millis();
    if (currentMillis - lastCommandPoll < COMMAND_POLL_INTERVAL) {
        return;
    }
    lastCommandPoll = currentMillis;

    WiFiClient client;
    HTTPClient http;
    String url = String(BACKEND_BASE_URL) + "/door/commands/next?deviceId=" + DEVICE_ID;

    if (!http.begin(client, url)) {
        return;
    }

    http.setTimeout(3000);
    http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);
    http.addHeader("x-device-api-key", DEVICE_API_KEY);
    http.addHeader("x-api-key", DEVICE_API_KEY);

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
        String response = http.getString();
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, response);

        if (!err && doc["success"] && doc["hasCommand"]) {
            String commandId = doc["command"]["commandId"].as<String>();
            String type = doc["command"]["type"].as<String>();
            unsigned long duration = doc["command"]["durationMs"] | 3000;

            if (type == "unlock") {
                Serial.println("\n[REMOTE COMMAND] Remote UNLOCK received from Dashboard!");
                digitalWrite(RELAY_PIN, RELAY_ACTIVE_LEVEL);
                currentRelayState = RELAY_STATE_UNLOCKED_ADMIN;
                relayUnlockStartTime = millis();
                relayUnlockDuration = duration;
                Serial.printf("[DOOR] Relay energized for %lu ms.\n", duration);

                ackDoorCommand(commandId, "executed");
            } else if (type == "lock") {
                Serial.println("\n[REMOTE COMMAND] Immediate LOCK received from Dashboard!");
                digitalWrite(RELAY_PIN, RELAY_LOCKED_LEVEL);
                currentRelayState = RELAY_STATE_LOCKED;
                relayUnlockStartTime = 0;
                Serial.println("[DOOR] Relay de-energized immediately (Locked).");

                ackDoorCommand(commandId, "executed");
            }
        }
    }

    http.end();
}

// -------------------- REMOTE ENROLLMENT --------------------

/**
 * Periodically polls the backend to check if the administrator has requested
 * card enrollment for this device.
 */
void checkEnrollmentStatus() {
    if (WiFi.status() != WL_CONNECTED) {
        return;
    }

    unsigned long currentMillis = millis();
    if (currentMillis - lastEnrollmentPoll < ENROLLMENT_POLL_INTERVAL) {
        return;
    }
    lastEnrollmentPoll = currentMillis;

    WiFiClient client;
    HTTPClient http;

    String url = String(BACKEND_BASE_URL) + "/enrollment/device/status?deviceId=" + DEVICE_ID;

    if (!http.begin(client, url)) {
        return;
    }

    http.setTimeout(3000);
    http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);
    http.addHeader("x-device-api-key", DEVICE_API_KEY);
    http.addHeader("x-api-key", DEVICE_API_KEY);

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
        String response = http.getString();
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, response);

        if (!err && doc["success"]) {
            bool active = doc["enrollmentActive"] | false;

            if (active) {
                if (!isEnrollmentMode) {
                    Serial.println("\n============================================");
                    Serial.println("[ENROLLMENT MODE ACTIVATED]");
                    Serial.print("Session ID: ");
                    Serial.println(doc["enrollmentId"].as<const char*>());
                    Serial.print("Expires in: ");
                    Serial.print(doc["expiresIn"].as<int>());
                    Serial.println("s");
                    Serial.println("Tap an RFID card to ENROLL (Relay disabled)");
                    Serial.println("============================================");
                }
                isEnrollmentMode = true;
                activeEnrollmentId = doc["enrollmentId"].as<String>();
            } else {
                if (isEnrollmentMode) {
                    Serial.println("\n[ENROLLMENT] Enrollment session ended. Returning to normal access control.");
                }
                isEnrollmentMode = false;
                activeEnrollmentId = "";
            }
        }
    }

    http.end();
}

/**
 * Submits a scanned RFID UID to the backend enrollment endpoint.
 * Does NOT verify access and NEVER activates the relay.
 */
bool submitEnrollmentScan(const String& uid, const String& enrollmentId) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Cannot submit enrollment scan: WiFi unavailable.");
        return false;
    }

    WiFiClient client;
    HTTPClient http;

    String url = String(BACKEND_BASE_URL) + "/enrollment/device/scan";

    if (!http.begin(client, url)) {
        Serial.println("HTTP initialization failed for enrollment scan.");
        return false;
    }

    http.setTimeout(5000);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);
    http.addHeader("x-device-api-key", DEVICE_API_KEY);
    http.addHeader("x-api-key", DEVICE_API_KEY);

    JsonDocument request;
    request["uid"] = uid;
    request["deviceId"] = DEVICE_ID;
    if (enrollmentId.length() > 0) {
        request["enrollmentId"] = enrollmentId;
    }

    String payload;
    serializeJson(request, payload);

    Serial.println("Submitting card to backend enrollment endpoint...");
    int httpCode = http.POST(payload);

    bool success = false;
    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
        Serial.print("Enrollment scan registered! Backend response: ");
        Serial.println(http.getString());
        success = true;
    } else {
        Serial.print("Enrollment scan submission failed. HTTP code: ");
        Serial.println(httpCode);
        Serial.println(http.getString());
        success = false;
    }

    http.end();
    return success;
}

// -------------------- RFID PROCESSING --------------------

void processCard() {
    if (!rfid.PICC_IsNewCardPresent()) {
        return;
    }

    if (!rfid.PICC_ReadCardSerial()) {
        return;
    }

    String uid = getUID();

    Serial.println("\n-------------------------");
    Serial.print("Card UID: ");
    Serial.println(uid);

    // If device is in enrollment mode, submit UID to enrollment session without unlocking relay
    if (isEnrollmentMode) {
        Serial.println("[ENROLLMENT] Processing scan for card enrollment...");
        bool submitted = submitEnrollmentScan(uid, activeEnrollmentId);

        if (submitted) {
            Serial.println("[ENROLLMENT] Scan recorded by server. Admin confirmation pending on dashboard.");
        } else {
            Serial.println("[ENROLLMENT] Failed to record scan on server.");
        }

        // Exit enrollment mode locally after scan
        isEnrollmentMode = false;
        activeEnrollmentId = "";
    } else {
        // Normal door access control operation
        bool authorized = verifyAccess(uid);

        Serial.print("Authorization result: ");
        Serial.println(authorized ? "TRUE" : "FALSE");

        if (authorized) {
            Serial.println("[ACCESS GRANTED]");
            // Non-blocking relay pulse
            digitalWrite(RELAY_PIN, RELAY_ACTIVE_LEVEL);
            currentRelayState = RELAY_STATE_UNLOCKED_RFID;
            relayUnlockStartTime = millis();
            relayUnlockDuration = UNLOCK_DURATION;
            Serial.printf("[DOOR] Unlocked by RFID for %lu ms.\n", UNLOCK_DURATION);
        } else {
            Serial.println("[ACCESS DENIED]");
        }
    }

    Serial.println("-------------------------");

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    delay(500);
}

// -------------------- SETUP --------------------

void setup() {
    Serial.begin(74880);
    delay(100);

    Serial.println("\nIoT RFID Door Lock");
    Serial.println("===================");

    // Initialize relay in locked state.
    digitalWrite(RELAY_PIN, RELAY_LOCKED_LEVEL);
    pinMode(RELAY_PIN, OUTPUT);

    connectWiFi();

    SPI.begin();
    rfid.PCD_Init();

    Serial.println("RFID reader initialized.");
    Serial.println("System ready. Normal access-control and remote polling active.");
}

// -------------------- MAIN LOOP --------------------

void loop() {
    maintainWiFi();
    updateRelayState();
    checkEnrollmentStatus();
    checkDoorCommands();
    processCard();
}
