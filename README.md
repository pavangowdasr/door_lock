# IoT RFID Door Lock Management System

Full-stack IoT access control solution comprising a Node.js + Express backend connected to MongoDB Atlas, an ESP8266 NodeMCU firmware with MFRC522 RFID reader and relay control, and a React + Vite + Tailwind CSS v4 administrative dashboard with remote RFID card enrollment and authenticated remote door control.

## Repository Structure

```text
├── backend/                  # Node.js + Express REST API (MongoDB Atlas)
│   ├── src/
│   │   ├── config/           # Database connection & status
│   │   ├── controllers/      # Auth, Card, Access, Enrollment, and Door controllers
│   │   ├── middleware/       # Error handling & API key/session auth
│   │   ├── models/           # Mongoose schemas (Card, AccessLog, Enrollment, DoorCommand)
│   │   ├── routes/           # Express route definitions (/auth, /cards, /access, /enrollment, /door)
│   │   ├── utils/            # UID normalizer & crypto password/session helpers
│   │   ├── app.js            # Express application setup
│   │   └── server.js         # HTTP server startup & graceful shutdown
│   ├── tests/                # Automated Node.js native test suite (59 tests)
│   └── package.json
│
├── frontend/                 # React + Vite + Tailwind CSS v4 Admin Dashboard
│   ├── src/
│   │   ├── components/       # Badges, Modals, ConfirmDialogs, Skeletons
│   │   ├── context/          # AuthContext (session) & ToastContext
│   │   ├── layouts/          # DashboardLayout (sidebar, header, mobile drawer)
│   │   ├── pages/            # Login, Overview (with Door Control), Cards, Logs, Settings
│   │   ├── services/         # Centralized API service (api, auth, cards, logs, enrollment, door)
│   │   ├── utils/            # Formatters & UID validation helpers
│   │   ├── App.jsx           # Client-side router & route protection
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js        # Vite dev proxy configuration
│   └── package.json
│
└── firmware/                 # ESP8266 NodeMCU C++ Firmware
    └── esp8266/
        └── main.cpp          # Non-blocking RFID reader, relay control, enrollment & remote commands
```

## Quick Start Guide

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Configure `backend/.env` with your settings:
```env
PORT=5000
MONGODB_URI=mongodb+srv://...
ADMIN_API_KEY=b90f3adecfd6758949c8fe12be2874f1b9f2aec52f60995d36534611cc9ad957
DEVICE_API_KEY=81f6abd1a88ce3ff079022b8aed06eef52308b4a10eb493dfbda03c94296ff9c
NODE_ENV=development
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=dedcc497afba67bbe970808f32ab1b66:42ea6e2f4a6e30fcf5e1a30fdc3f6aa77490e991beb292dbc26f3fc38f42209bbebce5bde77742d177325b93c906524302be2e88a39d641461565022c049b59b
SESSION_SECRET=c31b817fa973eef076413d7e5d8a8b19634e2c0bb8a4d2fb2d35d94729a674e2
```

> **Default Admin Credentials**:
> - Username: `admin`
> - Password: `admin123`

Start the backend:
```bash
npm run dev
```

Run backend automated test suite (59 tests):
```bash
npm test
```

### 2. Frontend Setup

In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. ESP8266 Firmware (PlatformIO)

The updated firmware is located at `firmware/esp8266/main.cpp` (and synchronized with `/home/pavan/Desktop/iot/esp8266_arduino/src/main.cpp`).

Compile firmware:
```bash
pio run -d /home/pavan/Desktop/iot/esp8266_arduino
```

Upload to ESP8266:
```bash
pio run -d /home/pavan/Desktop/iot/esp8266_arduino --target upload
```

---

## Remote Card Enrollment Workflow

1. **Initiate**: Administrator clicks **Add RFID Card** on the dashboard and selects **Scan with ESP8266**.
2. **Session Start**: Dashboard calls `POST /api/enrollment/start` (`deviceId: 'door-lock-01'`), creating an active 60s enrollment session.
3. **Hardware Poll**: ESP8266 periodically polls `GET /api/enrollment/device/status?deviceId=door-lock-01` (every 1.5s).
4. **Enrollment Mode**: ESP8266 enters enrollment mode and logs the session.
5. **Card Tap**: Administrator taps an RFID tag against the MFRC522 reader.
6. **Relay Safety**: The ESP8266 **never activates the relay** and submits the UID to `POST /api/enrollment/device/scan`.
7. **Pending Scan**: Backend records the UID as a pending scan result (not authorized yet).
8. **Dashboard Detection**: The dashboard polling detects the scanned UID, automatically populates the form, and prompts for an optional card label.
9. **Confirmation**: Admin clicks **Confirm Registration** (`POST /api/cards`), saving the card in MongoDB and completing the enrollment session.
10. **Device Reset**: The ESP8266 detects the completed session on its next poll and returns to normal door access control mode.
