# ShiftSync

A smart scheduling + shift swap platform for restaurants/hotels, with full authentication (Google OAuth, Microsoft OAuth, and local demo mode), role-based access control, and seeded demo data.

## Features

- ⚡ **Auto-generated schedules** based on forecasted sales, historical demand, employee availability, and labor budgets
- 🔥 **Burnout risk prediction** — detects doubles, clopens (close then open), and excessive consecutive days
- 🔄 **Intelligent shift swaps** with manager guardrails (role match, overtime check, availability check)
- 💰 **Real-time labor cost tracking** with budget vs. actual comparisons and daily/role breakdowns
- 🔐 **Authentication** — Google OAuth, Microsoft OAuth, or local demo mode
- 🛡️ **Role-based access control** — manager-only actions enforced on both frontend and backend

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + SQLite (better-sqlite3) + JWT
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts

## Getting Started

### Install dependencies
```bash
npm run install:all
```

### Configure environment
```bash
# Server
cp server/.env.example server/.env
# Edit server/.env and set JWT_SECRET (at minimum)

# Client (optional – only needed if backend is not on localhost:3001)
cp client/.env.example client/.env
```

### Run development servers
```bash
# Start both backend (port 3001) and frontend (port 3000) together
npm run dev
```

Or start them individually in separate terminals:
```bash
# Terminal 1 – backend (port 3001)
npm run dev:server

# Terminal 2 – frontend (port 3000)
npm run dev:client
```

Open http://localhost:3000

### Run tests
```bash
cd server && npm test
cd client && npm test
```

## Demo Mode

Demo mode lets you log in without any external OAuth provider. It is always available.

### Demo accounts (seeded automatically)

| Role     | Display Name           | Login Button                   |
|----------|------------------------|--------------------------------|
| Manager  | Alice Johnson          | "Login as Manager (Demo)"      |
| Employee | Bob Smith              | "Login as Employee (Demo)"     |

### Permissions by role

| Action                          | Manager | Employee |
|---------------------------------|---------|----------|
| View employees/schedules/shifts | ✅       | ✅        |
| Create/edit/delete employees    | ✅       | ❌        |
| Generate / publish schedules    | ✅       | ❌        |
| Approve / reject shift swaps    | ✅       | ❌        |
| Request a shift swap            | ✅       | ✅        |
| View configured data (`/api/config`) | Full | Scoped to own data |

### Reset the database
```bash
rm server/shiftsync.db
# Restart the server – it will reseed automatically
cd server && npm run dev
```

## Google OAuth Setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add the following **Authorized redirect URI**:
   ```
   http://localhost:3001/api/auth/google/callback
   ```
   For production, replace with your actual server URL.
4. Copy **Client ID** and **Client Secret** into `server/.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

## Microsoft OAuth Setup

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)
2. Register a new application
3. Under **Authentication**, add a **Web** redirect URI:
   ```
   http://localhost:3001/api/auth/microsoft/callback
   ```
4. Under **Certificates & secrets**, create a new **Client secret**
5. Copy the **Application (client) ID** and the secret value into `server/.env`:
   ```
   MICROSOFT_CLIENT_ID=your-client-id
   MICROSOFT_CLIENT_SECRET=your-client-secret
   # Optional – restrict to a specific tenant:
   MICROSOFT_TENANT_ID=your-tenant-id
   ```

## API Overview

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/demo-login | Demo login (`{ type: "manager" \| "employee" }`) |
| GET | /api/auth/google | Initiate Google OAuth flow |
| GET | /api/auth/google/callback | Google OAuth callback |
| GET | /api/auth/microsoft | Initiate Microsoft OAuth flow |
| GET | /api/auth/microsoft/callback | Microsoft OAuth callback |
| GET | /api/auth/me | Get current user (requires Bearer token) |
| POST | /api/auth/logout | Logout (client clears token) |

### Config

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/config | Role-scoped data (manager: all; employee: own data) |

### Employees (all require auth; write ops require manager)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/employees | List employees |
| POST | /api/employees | Create employee *(manager only)* |
| PUT | /api/employees/:id | Update employee *(manager only)* |
| DELETE | /api/employees/:id | Delete employee *(manager only)* |
| GET | /api/employees/:id/availability | Get availability |
| POST | /api/employees/:id/availability | Set availability *(manager only)* |

### Schedules (all require auth; write ops require manager)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/schedules | List schedules |
| POST | /api/schedules/generate | Auto-generate schedule *(manager only)* |
| GET | /api/schedules/:id/shifts | Get schedule shifts |
| GET | /api/schedules/:id/labor-cost | Get labor cost summary |
| GET | /api/schedules/:id/burnout-risks | Get burnout risk analysis |
| PUT | /api/schedules/:id | Update schedule status *(manager only)* |

### Shifts / Swaps / Forecasts (all require auth)

| Method | Path | Description |
|--------|------|-------------|
| PUT | /api/shifts/:id | Update a shift *(manager only)* |
| GET | /api/swaps | List shift swap requests |
| POST | /api/swaps | Request a shift swap |
| PUT | /api/swaps/:id/approve | Approve swap *(manager only)* |
| PUT | /api/swaps/:id/reject | Reject swap *(manager only)* |
| GET | /api/forecasts | Get forecasts |
| POST | /api/forecasts | Upsert forecast *(manager only)* |

<!-- original readme below -->
A smart scheduling + shift swap platform for restaurants/hotels.
