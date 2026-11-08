# IoT RFID Door Lock — Admin Dashboard (Frontend)

Clean, lightweight, modern administrative dashboard for managing physical RFID credentials and monitoring access attempts from ESP8266 IoT door lock hardware.

## Tech Stack

- **React 19**
- **Vite 6**
- **JavaScript (ES Modules)**
- **Tailwind CSS v4**
- **React Router 7**
- **Lucide React** (icons)
- **Native Fetch API**

## Security Principles

- **Zero Secrets in Frontend**: `ADMIN_API_KEY` and `DEVICE_API_KEY` are never exposed in JavaScript bundles, client code, or browser storage.
- **Single Administrator**: Exactly one administrator authenticated using secure HTTP-only cookies (`admin_session`) with `SameSite=Lax`.
- **Proxying in Development**: Uses Vite development proxy (`/api` -> `http://localhost:5000`) to guarantee same-origin browser requests without exposing backend URLs or experiencing CORS friction.
- **Hardware Isolation**: ESP8266 door lock units communicate exclusively with `/api/access/verify` using `DEVICE_API_KEY` on hardware.

## Features

1. **Dedicated Login Page**: Single administrator username and password verification with session persistence and rate limiting.
2. **System Overview**: Live backend health and MongoDB Atlas status, total/active/revoked card metrics, access granted/denied metrics, and transparent hardware status.
3. **RFID Card Management**:
   - Register new RFID tags with real-time hexadecimal UID validation (4–32 hex characters).
   - Graceful duplicate UID handling (`409 Conflict`).
   - Card listing with search by UID/label and status filters (All, Active, Revoked).
   - Activate and Revoke actions with confirmation dialog before revocation.
4. **Access Logs**:
   - Comprehensive audit trail of door access attempts.
   - Filter by access result (`granted` / `denied`) or search by specific Card UID.
   - Newest logs first with server-side pagination.
5. **System Settings**:
   - Backend runtime information (uptime, environment, database status).
   - Reference documentation and copyable JSON payload format for ESP8266 NodeMCU firmware.

## Getting Started

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The Vite dev server starts at `http://localhost:5173` and proxies `/api` requests to `http://localhost:5000`.

### 3. Production Build

```bash
npm run build
```

Build artifacts will be generated in `frontend/dist`.
