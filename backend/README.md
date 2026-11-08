# IoT RFID Door Lock Backend

A minimal, secure, and maintainable REST API backend for an IoT-based RFID door lock system built with Node.js, Express, and MongoDB Atlas (Mongoose).

---

## 1. Project Overview

This backend powers an automated RFID door access control system:
- **IoT Device Verification**: Door readers (e.g. ESP32, Arduino) query the API upon card taps to verify permissions (`granted` or `denied`).
- **Card Management**: Administrators register, retrieve, and revoke RFID cards.
- **Audit Logging**: Every access attempt (authorized, unknown card, revoked card) is automatically logged with timestamp and device ID.
- **Security & Authorization**: Distinct API keys protect administrative endpoints (`ADMIN_API_KEY`) and IoT device endpoints (`DEVICE_API_KEY`) with constant-time cryptographic validation.

---

## 2. Technology Stack

- **Runtime**: Node.js (v18+)
- **Language**: JavaScript (ES Modules, `"type": "module"`)
- **Framework**: Express.js
- **Database & ODM**: MongoDB / MongoDB Atlas with Mongoose
- **Environment**: `dotenv`
- **Security Middleware**: `helmet` (HTTP headers)
- **Rate Limiting**: `express-rate-limit`

---

## 3. Project Structure

```text
backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection and status utilities
│   ├── models/
│   │   ├── Card.js              # RFID Card Mongoose schema & indexes
│   │   └── AccessLog.js         # Access attempt audit log schema & indexes
│   ├── controllers/
│   │   ├── card.controller.js   # Card management logic & pagination
│   │   └── access.controller.js # Access verification & audit log retrieval
│   ├── routes/
│   │   ├── card.routes.js       # /api/cards routes
│   │   └── access.routes.js     # /api/access/verify & /api/access-logs
│   ├── middleware/
│   │   ├── auth.middleware.js   # Constant-time API key authentication
│   │   └── error.middleware.js  # Centralized error handling & 404 handler
│   ├── utils/
│   │   └── normalizeUID.js      # RFID UID normalization & validation
│   ├── app.js                   # Express app setup, Helmet & rate limiting
│   └── server.js                # Server entry point & graceful shutdown
├── tests/
│   ├── api.test.js              # Integration tests
│   └── normalizeUID.test.js     # Unit tests for UID normalizer
├── insomnia-collection.json     # Importable Insomnia v4 test collection
├── postman-collection.json      # Importable Postman v2.1 test collection
├── .env.example                 # Environment template
├── .gitignore                   # Git exclusions
├── package.json                 # Project manifest & scripts
└── README.md                    # Documentation
```

---

## 4. Environment Configuration

Copy `.env.example` to `.env` inside the `backend/` directory:

```bash
cp .env.example .env
```

Configure the environment variables in `.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/rfid_door_lock?retryWrites=true&w=majority
ADMIN_API_KEY=admin_secret_key_change_in_production
DEVICE_API_KEY=device_secret_key_change_in_production
NODE_ENV=development
```

> **Security Note**: Never commit the `.env` file to version control. The repository's `.gitignore` explicitly excludes `.env`.

---

## 5. Installation & Getting Started

### Prerequisites
- Node.js (v18 or higher recommended; developed and tested on Node 24)
- MongoDB instance (MongoDB Atlas cluster or local MongoDB on `mongodb://127.0.0.1:27017`)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
*(Starts Node with file watching enabled via `node --watch src/server.js`)*

### 3. Run the Production Server
```bash
npm start
```

### 4. Run the Automated Tests
```bash
npm test
```
The test suite automatically starts the server against a test database, runs all unit and integration test assertions, and cleans up.

---

## 6. Authentication & Security

Two separate API keys protect the API:
- `ADMIN_API_KEY`: Protects Card Management (`/api/cards`) and Access Logs (`/api/access-logs`).
- `DEVICE_API_KEY`: Protects Device Access Verification (`/api/access/verify`).

### Passing API Keys
API keys can be supplied via either:
1. `x-api-key` header:
   ```http
   x-api-key: your_api_key_here
   ```
2. `Authorization: Bearer <token>` header:
   ```http
   Authorization: Bearer your_api_key_here
   ```
3. Dedicated header (`x-admin-api-key` or `x-device-api-key`).

### Security Features
- **Timing-Safe Comparison**: Utilizes Node's `crypto.timingSafeEqual` over SHA-256 digests to prevent timing attacks.
- **UID Normalization**: Strips spaces, colons, and hyphens and converts hex values to uppercase before storage or comparison (e.g., `ce e4:e8-57` -> `CEE4E857`).
- **HTTP Header Hardening**: Powered by Helmet to prevent common web vulnerabilities.
- **Rate Limiting**: Protects endpoints against brute-force attempts.
- **Centralized Error Handling**: Ensures stack traces are never leaked in production responses.

---

## 7. API Endpoint Reference

| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Server uptime and MongoDB connection state |
| `POST` | `/api/cards` | `ADMIN_API_KEY` | Register an RFID card |
| `GET` | `/api/cards` | `ADMIN_API_KEY` | List registered cards with pagination |
| `GET` | `/api/cards/:uid` | `ADMIN_API_KEY` | Retrieve a specific card by UID |
| `PATCH` | `/api/cards/:uid/status` | `ADMIN_API_KEY` | Update card status (`active` or `revoked`) |
| `POST` | `/api/access/verify` | `DEVICE_API_KEY` | Check authorization for an RFID card tap |
| `GET` | `/api/access-logs` | `ADMIN_API_KEY` | Retrieve access audit logs (newest first) |

---

## 8. Detailed API Documentation & Examples

### 1. Health Check
`GET /api/health`

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "uptime": 45.2,
  "timestamp": "2026-11-08T07:45:00.000Z",
  "database": "connected"
}
```

---

### 2. Register RFID Card
`POST /api/cards`  
*Header: `x-api-key: <ADMIN_API_KEY>`*

**Request Body:**
```json
{
  "uid": "CEE4E857",
  "label": "Master Admin Card"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Card registered successfully",
  "data": {
    "uid": "CEE4E857",
    "label": "Master Admin Card",
    "status": "active",
    "createdAt": "2026-11-08T07:46:12.123Z",
    "updatedAt": "2026-11-08T07:46:12.123Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid or missing UID.
- `409 Conflict`: Card with this UID is already registered.

---

### 3. List Cards
`GET /api/cards?page=1&limit=10&status=active`  
*Header: `x-api-key: <ADMIN_API_KEY>`*

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "uid": "CEE4E857",
      "label": "Master Admin Card",
      "status": "active",
      "createdAt": "2026-11-08T07:46:12.123Z",
      "updatedAt": "2026-11-08T07:46:12.123Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 4. Get Card By UID
`GET /api/cards/:uid`  
*Header: `x-api-key: <ADMIN_API_KEY>`*

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "uid": "CEE4E857",
    "label": "Master Admin Card",
    "status": "active",
    "createdAt": "2026-11-08T07:46:12.123Z",
    "updatedAt": "2026-11-08T07:46:12.123Z"
  }
}
```

**Error Response (`404 Not Found`):**
```json
{
  "success": false,
  "message": "Card with UID 'CEE4E857' not found"
}
```

---

### 5. Update Card Status
`PATCH /api/cards/:uid/status`  
*Header: `x-api-key: <ADMIN_API_KEY>`*

**Request Body:**
```json
{
  "status": "revoked"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Card status updated to 'revoked'",
  "data": {
    "uid": "CEE4E857",
    "label": "Master Admin Card",
    "status": "revoked",
    "createdAt": "2026-11-08T07:46:12.123Z",
    "updatedAt": "2026-11-08T07:48:30.456Z"
  }
}
```

---

### 6. Verify Access (IoT Device)
`POST /api/access/verify`  
*Header: `x-api-key: <DEVICE_API_KEY>`*

**Request Body:**
```json
{
  "uid": "CEE4E857",
  "deviceId": "door-lock-01"
}
```

**Authorized Response (`200 OK`):**
```json
{
  "success": true,
  "authorized": true,
  "message": "Access granted"
}
```

**Denied Response (`200 OK`):**
```json
{
  "success": true,
  "authorized": false,
  "message": "Access denied"
}
```

> Both authorized and denied attempts automatically log to MongoDB AccessLog (`authorized`, `revoked_card`, or `unknown_card`).

---

### 7. Access Logs
`GET /api/access-logs?page=1&limit=20&result=granted`  
*Header: `x-api-key: <ADMIN_API_KEY>`*

**Query Parameters:**
- `page`: Page number (default: `1`)
- `limit`: Items per page (default: `20`, max: `100`)
- `uid`: Filter by normalized RFID UID
- `result`: Filter by `granted` or `denied`

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "672dc1a2f6a8e57832810a01",
      "uid": "CEE4E857",
      "deviceId": "door-lock-01",
      "result": "granted",
      "reason": "authorized",
      "timestamp": "2026-11-08T07:50:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## 9. Testing with Insomnia or Postman

### Importing Collections
1. **Insomnia**:
   - Open Insomnia.
   - Click **Preferences** or **Application Menu** -> **Import/Export** -> **Import Data**.
   - Select `file` and choose `backend/insomnia-collection.json`.
   - Open the imported workspace and switch to the `Base Environment`. Update `base_url`, `admin_api_key`, and `device_api_key` to match your local `.env`.
2. **Postman**:
   - Open Postman.
   - Click **Import** in the top left.
   - Select or drag and drop `backend/postman-collection.json`.
   - Set the collection variables (`base_url`, `admin_api_key`, `device_api_key`).

### Quick cURL Testing Examples

```bash
# 1. Health Check
curl -X GET http://localhost:5000/api/health

# 2. Register Card
curl -X POST http://localhost:5000/api/cards \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_admin_secret_key_here" \
  -d '{"uid": "CEE4E857", "label": "Admin Card"}'

# 3. Verify Access (Active Card)
curl -X POST http://localhost:5000/api/access/verify \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_device_secret_key_here" \
  -d '{"uid": "CEE4E857", "deviceId": "door-lock-01"}'

# 4. Revoke Card
curl -X PATCH http://localhost:5000/api/cards/CEE4E857/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_admin_secret_key_here" \
  -d '{"status": "revoked"}'

# 5. Verify Access (Now Revoked -> Denied)
curl -X POST http://localhost:5000/api/access/verify \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_device_secret_key_here" \
  -d '{"uid": "CEE4E857", "deviceId": "door-lock-01"}'

# 6. Retrieve Access Audit Logs
curl -X GET "http://localhost:5000/api/access-logs?page=1&limit=10" \
  -H "x-api-key: your_admin_secret_key_here"
```

---

## 10. License
ISC
