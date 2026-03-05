# ShiftSync

A smart scheduling + shift swap platform for restaurants/hotels.

## Features

- ⚡ **Auto-generated schedules** based on forecasted sales, historical demand, employee availability, and labor budgets
- 🔥 **Burnout risk prediction** — detects doubles, clopens (close then open), and excessive consecutive days
- 🔄 **Intelligent shift swaps** with manager guardrails (role match, overtime check, availability check)
- 💰 **Real-time labor cost tracking** with budget vs. actual comparisons and daily/role breakdowns

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + SQLite (better-sqlite3)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later (included with Node.js)

---

### 1 — Clone & install

```bash
git clone https://github.com/Katlyn627/ShiftSync.git
cd ShiftSync

# Install root, server, and client dependencies in one step
npm run install:all
```

> Or install each workspace separately:
> ```bash
> cd server && npm install
> cd ../client && npm install
> ```

---

### 2 — Environment variables (optional)

The server works out of the box with safe defaults for local development.
For production or to customise behaviour, create `server/.env`:

```dotenv
# Port the backend listens on (default: 3001)
PORT=3001

# Secret used to sign JWTs — set a strong random value in production
# Generate one with: openssl rand -hex 32
JWT_SECRET=replace-with-a-strong-random-secret
```

---

### 3 — Run in development

Both servers start with a single command from the project root:

```bash
npm run dev
```

This runs the backend and frontend concurrently:

| Service  | URL                      | Notes                          |
|----------|--------------------------|--------------------------------|
| Backend  | http://localhost:3001    | Auto-restarts on file changes  |
| Frontend | http://localhost:3000    | Hot-module replacement (Vite)  |

The SQLite database is created automatically on first run and seeded with demo data — no extra setup needed.

> To start each server individually:
> ```bash
> # Terminal 1 — backend
> npm run dev:server
>
> # Terminal 2 — frontend
> npm run dev:client
> ```

---

### 4 — Build for production

Compile the TypeScript backend and bundle the React frontend:

```bash
npm run build
```

This runs both steps in sequence:

| Step            | Command                  | Output                  |
|-----------------|--------------------------|-------------------------|
| Server (tsc)    | `npm run build:server`   | `server/dist/`          |
| Client (Vite)   | `npm run build:client`   | `client/dist/`          |

---

### 5 — Run in production

After building, start the server. It serves both the API and the compiled React app on a single port:

```bash
npm run start
```

Open http://localhost:3001 (or the `PORT` you configured).

---

### Run tests

```bash
# All tests (server + client)
npm test

# Server only
npm run test:server

# Client only
npm run test:client
```

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/employees | List employees |
| POST | /api/employees | Create employee |
| PUT | /api/employees/:id | Update employee |
| DELETE | /api/employees/:id | Delete employee |
| GET/POST | /api/employees/:id/availability | Get/set availability |
| GET | /api/schedules | List schedules |
| POST | /api/schedules/generate | Auto-generate schedule |
| GET | /api/schedules/:id/shifts | Get schedule shifts |
| GET | /api/schedules/:id/labor-cost | Get labor cost summary |
| GET | /api/schedules/:id/burnout-risks | Get burnout risk analysis |
| PUT | /api/schedules/:id | Update schedule (publish/draft) |
| PUT | /api/shifts/:id | Update a shift |
| GET | /api/swaps | List shift swap requests |
| POST | /api/swaps | Request a shift swap |
| PUT | /api/swaps/:id/approve | Approve swap |
| PUT | /api/swaps/:id/reject | Reject swap |
| GET/POST | /api/forecasts | Get/upsert forecasts |

