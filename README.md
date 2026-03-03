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

### Install dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### Run development servers
```bash
# Terminal 1 – backend (port 3001)
cd server && npm run dev

# Terminal 2 – frontend (port 3000)
cd client && npm run dev
```

Open http://localhost:3000

### Run tests
```bash
cd server && npm test
cd client && npm test
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

<!-- original readme below -->
A smart scheduling + shift swap platform for restaurants/hotels.
