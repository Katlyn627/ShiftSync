<div align="center">

# ShiftSync

**Smart scheduling & shift-swap platform for restaurants and hotels**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| ⚡ | **AI-Generated Schedules** | Auto-builds weekly rosters from forecasted revenue, historical demand, employee availability, and labor budgets |
| 🔥 | **Burnout Risk Detection** | Flags doubles, clopens (close-then-open), and excessive consecutive days before publishing |
| 🔄 | **Intelligent Shift Swaps** | Employee-driven swap requests with automatic role-match, overtime, and availability checks |
| 💰 | **Real-Time Labor Cost Tracking** | Live budget vs. actual comparisons with daily and per-role breakdowns |
| 📊 | **Demand-Based Staffing** | Recommends staffing levels per day based on revenue forecasts |
| 📈 | **Profitability Metrics** | Prime cost, RevPASH, table turnover rate, sales by day, and turnover risk on the manager dashboard |
| 🔐 | **Role-Based Access** | Manager and employee views with Google OAuth or username/password login |

---

## 🖼 Screenshots

### Login

<img src="https://github.com/user-attachments/assets/77632fcc-3772-4220-ae90-8e128007d206" alt="Login page" width="700" />

> Sign in with Google OAuth or username/password — see [docs/demo-data.md](docs/demo-data.md) for the full list of pre-loaded accounts.

---

### Dashboard

<img src="https://github.com/user-attachments/assets/b67f1c96-c5e7-4532-a2a4-f35d398d8d13" alt="Manager Dashboard" width="700" />

> Weekly KPIs at a glance: projected cost vs. budget, burnout-risk counts, profitability metrics (prime cost, RevPASH, table turnover, sales by day), revenue distribution by daypart, and sales-by-day chart.

---

### Schedule Builder

<img src="https://github.com/user-attachments/assets/a3198fcd-4ba0-4b45-a7c7-57404a9fb4d5" alt="Schedule Builder" width="700" />

> One-click schedule generation with drag-and-drop reassignment, shift-time editing, and publish/draft toggling. Intelligence filters highlight short-staff risk, overstaffed days, burnout alerts, and budget status at the top of the grid.

---

### Employees *(Manager only)*

<img src="https://github.com/user-attachments/assets/b251cbf3-32ea-4f4a-91ca-962d004bc145" alt="Employees page" width="700" />

> Add, edit, or remove team members. Each row shows role, department, site, hourly rate, and weekly-hour cap with colour-coded role badges.

---

### Shift Swaps

<img src="https://github.com/user-attachments/assets/89912b18-2051-4abf-bf6e-fcd01a603cd7" alt="Shift Swaps page" width="700" />

> Employees request swaps directly from the schedule. Managers review each request with automatic guardrails (role match, overtime limit, availability) before approving or rejecting.

---

### Time-Off Approvals *(Manager only)*

<img src="https://github.com/user-attachments/assets/4d6914d8-8823-4e86-81f5-45ce65244c8c" alt="Time-Off Approvals page" width="700" />

> Managers review pending time-off requests, approve or deny them with optional notes, and filter by status (pending / approved / rejected / all).

---

### My Profile

<img src="https://github.com/user-attachments/assets/e52a96f0-0fa9-4917-a6c7-50ac6bea0356" alt="Profile page" width="700" />

> Each employee manages their own availability windows, submits time-off requests, and views team-contact info — all in one place.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20 or later
- **npm** 9 or later

### 1. Clone & install

```bash
git clone https://github.com/Katlyn627/ShiftSync.git
cd ShiftSync

# Install everything from the repo root
npm install          # installs concurrently (used by root dev script)
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 2. Configure environment variables

The server reads a **`server/.env`** file. Copy the provided template:

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in the values (inline comments explain each one).
The most important variables before first run:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Port the Express server listens on |
| `JWT_SECRET` | — | Secret used to sign JWTs — **required in production** |
| `SESSION_SECRET` | — | Secret for the OAuth session cookie — **required in production** |
| `DB_PATH` | `./shiftsync.db` | Path to the SQLite database file |
| `CLIENT_URL` | `http://localhost:3000` | React frontend origin (used for OAuth redirect) |

> **`server/.env` is listed in `.gitignore` and will never be committed. Never commit real secrets.**

#### Enabling Google OAuth *(optional)*

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) and create an **OAuth 2.0 Client ID** (type: *Web application*).
2. Add the callback URL to **Authorised redirect URIs**:
   - **Local:** `http://localhost:3001/api/auth/google/callback`
   - **Production:** `https://<your-domain>/api/auth/google/callback`

   > The callback is served by the Express server on port **3001**, not the Vite dev-server on port 3000. Registering the wrong port is the most common cause of `Error 400: redirect_uri_mismatch`.

3. Add the credentials to `server/.env`:

   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   CLIENT_URL=http://localhost:3000
   ```

`GOOGLE_CALLBACK_URL` is **optional** — when omitted the server derives it automatically from the incoming request, which works for both local dev and production without extra configuration.

If `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` are blank, `/api/auth/google` returns `503` and the Google sign-in button is hidden from the UI. Username/password login still works.

<details>
<summary><strong>Troubleshooting <code>Error 400: redirect_uri_mismatch</code></strong></summary>

| Cause | Fix |
|-------|-----|
| Registered `http://localhost:3000/…` (frontend) instead of `http://localhost:3001/…` (backend) | Update the URI in Google Cloud Console to port **3001** |
| `GOOGLE_CALLBACK_URL` is set to a `localhost` URL in a production deployment | Remove the override or set it to the correct production URL |
| Production domain in Google Cloud Console doesn't match deployed domain | Register `https://<your-domain>/api/auth/google/callback` |

When the server starts with Google OAuth configured it prints the effective callback URL to the console — use that as a reference.

</details>

### 3. Run development servers

```bash
# From the repo root — starts both servers concurrently
npm run dev

# Or run them separately:
# Terminal 1 – backend  (http://localhost:3001)
cd server && npm run dev

# Terminal 2 – frontend (http://localhost:3000)
cd client && npm run dev
```

Open **http://localhost:3000** in your browser.

32 demo accounts are pre-loaded across 4 sites. Use a manager account to access all features:

| Username | Role | Site | Password |
|---|---|---|---|
| `alice` | Manager | Bella Napoli (Restaurant, Chicago) | `password123` |
| `iris` | Manager | The Blue Door (Restaurant, Austin) | `password123` |
| `quinn` | Manager | Grand Pacific Hotel (Hotel, New York) | `password123` |
| `yara` | Manager | Seaside Suites & Spa (Hotel, Miami) | `password123` |

For the complete list of all 32 accounts (including employee-role accounts), see [docs/demo-data.md](docs/demo-data.md).

### 4. Run tests

```bash
# From the repo root
npm test

# Or individually:
cd server && npm test
cd client && npm test
```

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS 4 · Recharts · React Router 6 · Radix UI |
| **Backend** | Node.js · Express · TypeScript · better-sqlite3 (SQLite) |
| **Auth** | JWT (username/password) · Passport.js + Google OAuth 2.0 |
| **Testing** | Vitest (client) · Jest + Supertest (server) |

---

## 📡 API Reference

### Employees

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/employees` | List all employees |
| `POST` | `/api/employees` | Create an employee |
| `PUT` | `/api/employees/:id` | Update an employee |
| `DELETE` | `/api/employees/:id` | Delete an employee |
| `GET` / `POST` | `/api/employees/:id/availability` | Get or set availability rules |

### Schedules & Shifts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/schedules` | List schedules |
| `POST` | `/api/schedules/generate` | Auto-generate a schedule |
| `GET` | `/api/schedules/:id/shifts` | Get shifts for a schedule |
| `GET` | `/api/schedules/:id/labor-cost` | Labor cost summary |
| `GET` | `/api/schedules/:id/burnout-risks` | Burnout risk analysis |
| `GET` | `/api/schedules/:id/profitability-metrics` | Profitability metrics (prime cost, RevPASH, sales by day, etc.) |
| `PUT` | `/api/schedules/:id` | Update schedule (publish / draft) |
| `PUT` | `/api/shifts/:id` | Update a single shift |

### Shift Swaps

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/swaps` | List swap requests |
| `POST` | `/api/swaps` | Submit a swap request |
| `PUT` | `/api/swaps/:id/approve` | Approve a swap |
| `PUT` | `/api/swaps/:id/reject` | Reject a swap |

### Forecasts & Auth

| Method | Path | Description |
|--------|------|-------------|
| `GET` / `POST` | `/api/forecasts` | Get or upsert revenue forecasts |
| `POST` | `/api/auth/login` | Username/password login |
| `POST` | `/api/auth/register` | Register a new user account |
| `GET` | `/api/auth/google` | Initiate Google OAuth flow |
| `GET` | `/api/auth/google/callback` | Google OAuth callback |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.