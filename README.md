# IoT RFID Door Lock Management System

Full-stack IoT access control solution comprising a Node.js + Express backend connected to MongoDB Atlas and a React + Vite + Tailwind CSS v4 administrative dashboard for managing physical RFID credentials and monitoring ESP8266 door lock units.

## Repository Structure

```text
├── backend/                  # Node.js + Express REST API (MongoDB Atlas)
│   ├── src/
│   │   ├── config/           # Database connection & status
│   │   ├── controllers/      # Auth, Card, and Access controllers
│   │   ├── middleware/       # Error handling & API key/session auth
│   │   ├── models/           # Mongoose schemas (Card, AccessLog)
│   │   ├── routes/           # Express route definitions
│   │   ├── utils/            # UID normalizer & crypto password/session helpers
│   │   ├── app.js            # Express application setup
│   │   └── server.js         # HTTP server startup & graceful shutdown
│   ├── tests/                # Automated Node.js native test suite
│   └── package.json
│
└── frontend/                 # React + Vite + Tailwind CSS v4 Admin Dashboard
    ├── src/
    │   ├── components/       # Badges, Modals, ConfirmDialogs, Skeletons
    │   ├── context/          # AuthContext (session) & ToastContext
    │   ├── layouts/          # DashboardLayout (sidebar, header, mobile drawer)
    │   ├── pages/            # Login, Overview, Cards, Logs, Settings
    │   ├── services/         # Centralized API service (api, auth, cards, logs)
    │   ├── utils/            # Formatters & UID validation helpers
    │   ├── App.jsx           # Client-side router & route protection
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js        # Vite dev proxy configuration
    └── package.json
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

Run backend automated tests (36 tests):
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

## Security Architecture

- **No Secrets Exposed**: Neither `ADMIN_API_KEY` nor `DEVICE_API_KEY` is present in browser bundles or client-side storage.
- **Session Authentication**: Browser administration uses signed, HTTP-only cookies (`admin_session`) with `SameSite=Lax` and login rate limiting.
- **Hardware Isolation**: The ESP8266 microcontroller verifies cards via `POST /api/access/verify` using `DEVICE_API_KEY` passed in the `x-device-api-key` header.
- **API Tooling Support**: Bruno / Postman / cURL can still use `ADMIN_API_KEY` headers without restriction.
