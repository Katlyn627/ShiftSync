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

## Table of Contents

- [Features](#-features)
- [Screenshots](#-screenshots)
- [Video Walk-through](#-video-walk-through)
- [Getting Started](#-getting-started)
- [Tech Stack](#-tech-stack)
- [API Reference](#-api-reference)
- [Product Requirements](#-product-requirements)
- [License](#-license)

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
| 🏪 | **Open Shift Marketplace** | Post uncovered shifts; employees self-claim with automatic eligibility checks (role, certifications, rest, overtime) |
| 📋 | **Burnout Surveys** | Validated WHO-aligned burnout measurement campaigns with anonymized, aggregated results |
| ⚖️ | **Workforce Fairness** | Monitor equitable distribution of hours, night shifts, and weekends with schedule instability tracking |
| 🔐 | **Role-Based Access** | Manager and employee views with Google OAuth or username/password login |

---

## 🖼 Screenshots

### Login

<div align="center">
  <img src="https://github.com/user-attachments/assets/222d9020-e6c3-447d-a290-e16c74015574" alt="Login page" width="800" />
  <br/>
  <em>Sign in with Google OAuth or username/password — see <a href="docs/demo-data.md">docs/demo-data.md</a> for the full list of pre-loaded accounts.</em>
</div>

---

### Manager Dashboard

<div align="center">
  <img src="https://github.com/user-attachments/assets/342e9822-1601-4276-bea7-1237fd9ff9e4" alt="Manager Dashboard" width="800" />
  <br/>
  <em>Weekly KPIs at a glance: projected cost vs. budget, burnout-risk counts, profitability metrics (prime cost, RevPASH, table turnover, sales by day), revenue distribution by daypart, and sales-by-day chart.</em>
</div>

---

### Schedule Builder

<div align="center">
  <img src="https://github.com/user-attachments/assets/ec4abed0-8318-43ae-9d88-42170ff065ba" alt="Schedule Builder" width="800" />
  <br/>
  <em>One-click schedule generation with drag-and-drop reassignment, shift-time editing, and publish/draft toggling. Intelligence filters highlight short-staff risk, overstaffed days, burnout alerts, and budget status at the top of the grid.</em>
</div>

---

### Employees & Shift Swaps

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <img src="https://github.com/user-attachments/assets/2dd1542e-fdec-41d5-8044-bea88ad5e85c" alt="Employees page" width="100%" />
        <br/>
        <em><strong>Employees</strong> <em>(Manager only)</em> — Add, edit, or remove team members. Each row shows role, department, site, hourly rate, and weekly-hour cap with color-coded role badges.</em>
      </td>
      <td align="center" width="50%">
        <img src="https://github.com/user-attachments/assets/de27c966-e90d-43ac-9993-8b406d6b9c1f" alt="Shift Swaps page" width="100%" />
        <br/>
        <em><strong>Shift Swaps</strong> — Employees request swaps directly from the schedule. Managers review each request with automatic guardrails (role match, overtime limit, availability) before approving or rejecting.</em>
      </td>
    </tr>
  </table>
</div>

---

### Open Shifts & Surveys

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <img src="https://github.com/user-attachments/assets/4d08ebe5-8cce-4085-a96b-25c6383e447a" alt="Open Shifts page" width="100%" />
        <br/>
        <em><strong>Open Shift Marketplace</strong> — Post uncovered shifts with reason and certification requirements. Employees self-claim and managers review offers with automatic eligibility checks.</em>
      </td>
      <td align="center" width="50%">
        <img src="https://github.com/user-attachments/assets/a2e3d85f-e592-4f88-b93b-e6711ed5a2bd" alt="Burnout Surveys page" width="100%" />
        <br/>
        <em><strong>Burnout Surveys</strong> — Create and manage validated burnout measurement campaigns. Results are anonymized and aggregated (min. group size of 5) — never used punitively.</em>
      </td>
    </tr>
  </table>
</div>

---

### Fairness, Time-Off & Profile

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <img src="https://github.com/user-attachments/assets/e827db7c-f11e-45eb-ba1f-1b4d1999fcfe" alt="Workforce Fairness page" width="100%" />
        <br/>
        <em><strong>Workforce Fairness</strong> <em>(Manager only)</em> — Monitor equitable distribution of hours, night shifts, and weekend assignments with per-role breakdowns and fairness flags.</em>
      </td>
      <td align="center" width="50%">
        <img src="https://github.com/user-attachments/assets/773997ab-3737-4df0-a30b-c43a143139bf" alt="Time-Off Approvals page" width="100%" />
        <br/>
        <em><strong>Time-Off Approvals</strong> <em>(Manager only)</em> — Review pending requests, approve or deny with optional notes, and filter by status.</em>
      </td>
    </tr>
    <tr>
      <td align="center" width="50%" colspan="2">
        <img src="https://github.com/user-attachments/assets/c572354f-4a9d-4e88-813b-76df9a887de0" alt="Profile page" width="50%" />
        <br/>
        <em><strong>My Profile</strong> — Each employee manages their own availability windows, submits time-off requests, and views team-contact info — all in one place.</em>
      </td>
    </tr>
  </table>
</div>

---

## 🎬 Video Walk-through

<div align="center">

<!-- Add your video walk-through here. Options:
     1. YouTube: replace the src URL below with your YouTube embed link
        <iframe width="800" height="450" src="https://www.youtube.com/embed/YOUR_VIDEO_ID" frameborder="0" allowfullscreen></iframe>
     2. GitHub-hosted video: upload the .mp4 to a GitHub issue or release, then use:
        <video src="YOUR_GITHUB_VIDEO_URL" controls width="800"></video>
     3. Loom or other platform: paste the embed code provided by that platform.
-->

> 📹 **Video walk-through coming soon.**
> To add one, upload your screen recording to a GitHub issue or YouTube and paste the embed link here.

</div>

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

## 📋 Product Requirements

ShiftSync is designed as an integrated system — **workflow + rule engine + measurement + governance** — to meaningfully reduce burnout risk, not just automate scheduling.

For the full product requirements, data needs, governance guidelines, and validation plan, see:

**[docs/product-requirements.md](docs/product-requirements.md)**

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
