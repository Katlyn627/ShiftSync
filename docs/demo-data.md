# ShiftSync Demo Dataset

This document describes the multi-site seed dataset included with ShiftSync.
The data is automatically loaded when the server starts against an **empty database**.

---

## Sites (4 total)

| # | Name | City, State | Type | Timezone |
|---|------|-------------|------|----------|
| 1 | Bella Napoli | Chicago, IL | Restaurant | America/Chicago |
| 2 | The Blue Door | Austin, TX | Restaurant | America/Chicago |
| 3 | Grand Pacific Hotel | New York, NY | Hotel | America/New_York |
| 4 | Seaside Suites & Spa | Miami, FL | Hotel | America/New_York |

---

## Employees (32 total — 8 per site)

Each employee has:
- `first_name`, `last_name`, `email`, `phone` (US format)
- `department`, `role_title`
- `hire_date`
- `hourly_rate`, `weekly_hours_max`
- `site_id` (FK to sites table)
- `photo_url` using `https://i.pravatar.cc/150?u=shiftsync_<key>` for stable, realistic avatars

### Restaurant roles
Manager · Server · Kitchen · Bar · Host

### Hotel roles
Manager · Front Desk · Housekeeping · F&B · Maintenance

---

## Users / Authentication

Every employee has a corresponding login. Password is `password123` for all accounts.

### Site 1 — Bella Napoli (Restaurant, Chicago IL)

| Username | Full Name | Role | Role Title | Hourly Rate |
|----------|-----------|------|------------|-------------|
| `alice` | Alice Johnson | Manager | General Manager | $24.00 |
| `bob` | Bob Smith | Server | Lead Server | $14.00 |
| `carol` | Carol White | Server | Server | $13.50 |
| `david` | David Brown | Kitchen | Sous Chef | $19.00 |
| `eve` | Eve Davis | Kitchen | Line Cook | $17.00 |
| `frank` | Frank Miller | Bar | Head Bartender | $17.50 |
| `grace` | Grace Wilson | Host | Host / Cashier | $13.00 |
| `henry` | Henry Moore | Server | Server | $13.50 |

### Site 2 — The Blue Door (Restaurant, Austin TX)

| Username | Full Name | Role | Role Title | Hourly Rate |
|----------|-----------|------|------------|-------------|
| `iris` | Iris Taylor | Manager | Restaurant Manager | $23.00 |
| `jack` | Jack Anderson | Server | Server | $13.50 |
| `karen` | Karen Thomas | Server | Senior Server | $14.50 |
| `liam` | Liam Jackson | Kitchen | Prep Cook | $16.00 |
| `mia` | Mia Robinson | Kitchen | Line Cook | $17.00 |
| `noah` | Noah Harris | Bar | Bartender | $16.00 |
| `olivia` | Olivia Martin | Host | Host | $12.50 |
| `peter` | Peter Clark | Server | Server | $13.00 |

### Site 3 — Grand Pacific Hotel (Hotel, New York NY)

| Username | Full Name | Role | Role Title | Hourly Rate |
|----------|-----------|------|------------|-------------|
| `quinn` | Quinn Lewis | Manager | Hotel General Manager | $30.00 |
| `rachel` | Rachel Scott | Front Desk | Front Desk Agent | $18.00 |
| `sam` | Sam Turner | Front Desk | Night Auditor | $19.50 |
| `tina` | Tina Mitchell | Housekeeping | Room Attendant | $16.50 |
| `uma` | Uma Johnson | Housekeeping | Housekeeping Supervisor | $20.00 |
| `victor` | Victor Lee | F&B | F&B Attendant | $17.00 |
| `wendy` | Wendy Chen | Maintenance | Maintenance Technician | $21.00 |
| `xavier` | Xavier Brown | Front Desk | Front Desk Supervisor | $22.00 |

### Site 4 — Seaside Suites & Spa (Hotel, Miami FL)

| Username | Full Name | Role | Role Title | Hourly Rate |
|----------|-----------|------|------------|-------------|
| `yara` | Yara Davis | Manager | Operations Manager | $28.00 |
| `zach` | Zach Wilson | Front Desk | Front Desk Agent | $17.50 |
| `amy` | Amy Taylor | Front Desk | Night Auditor | $19.00 |
| `ben` | Ben Martinez | Housekeeping | Room Attendant | $16.00 |
| `clara` | Clara Nguyen | Housekeeping | Laundry Attendant | $15.50 |
| `dan` | Dan Roberts | F&B | Poolside Server | $15.00 |
| `elena` | Elena Kim | Maintenance | Facilities Technician | $20.50 |
| `felix` | Felix Garcia | F&B | Banquet Server | $15.50 |

> Managers (`alice`, `iris`, `quinn`, `yara`) have `is_manager = 1`; all others have `is_manager = 0`.
> Duplicate first names across sites get a numeric suffix (e.g. `amy2`), though none exist in the current seed.

---

## Schedules

Each site gets **2 weekly schedules**:

| Week | Status |
|------|--------|
| Prior week (Mon –7) | `published` |
| Current week (Mon +0) | `draft` |

Labor budgets:
- Bella Napoli: $4,500 / week
- The Blue Door: $4,200 / week
- Grand Pacific Hotel: $8,500 / week
- Seaside Suites & Spa: $8,000 / week

---

## Shifts

Shifts are seeded for all 7 days of each schedule.

### Restaurant shift pattern
| Role | Shift |
|------|-------|
| Manager | 09:00 – 17:00 |
| Server | 11:00 – 15:00 (lunch) |
| Server | 16:00 – 23:00 (dinner) |
| Kitchen | 09:00 – 17:00 |
| Kitchen | 15:00 – 23:00 |
| Bar | 17:00 – 23:30 (weekday) |
| **Bar** | **17:00 – 01:00** (**overnight Fri/Sat**) |
| Host | 11:00 – 19:00 |

### Hotel shift pattern (24-hour coverage)
| Role | Shift |
|------|-------|
| Manager | 08:00 – 16:00 |
| Front Desk (day) | 07:00 – 15:00 |
| Front Desk (evening) | 15:00 – 23:00 |
| **Front Desk (night)** | **23:00 – 07:00** (**overnight**) |
| Housekeeping | 08:00 – 16:00 |
| F&B (breakfast) | 06:00 – 14:00 |
| F&B (dinner) | 17:00 – 23:00 |
| Maintenance | 08:00 – 16:00 |

---

## Overtime Tracking

A `weekly_overtime` record is created for every employee who worked **≥ 20 hours** in the prior week.
Fields:
- `regular_hours` — hours up to 40
- `overtime_hours` — hours beyond 40
- `overtime_pay` — `overtime_hours × hourly_rate × 1.5`

API: `GET /api/overtime`

---

## Shift Swap Requests (7 total)

| Site | Requester | Target | Reason | Status |
|------|-----------|--------|--------|--------|
| Bella Napoli | Bob (Server) | Carol (Server) | Family event | **pending** |
| Bella Napoli | David (Kitchen) | Eve (Kitchen) | Doctor appt | **approved** |
| Bella Napoli | Frank (Bar) | — | Personal | **rejected** |
| The Blue Door | Karen (Server) | Jack (Server) | Class conflict | **pending** |
| Grand Pacific | Rachel (Front Desk) | Xavier (Front Desk) | Training | **approved** |
| Grand Pacific | Tina (Housekeeping) | — | Medical appt | **pending** |
| Seaside Suites | Zach (Front Desk) | Amy (Front Desk) | Personal | **rejected** |

---

## Burnout Data

The prior week's shift data is designed to produce meaningful burnout output:
- Hotel night auditors work overnight shifts (late-night flag)
- Some restaurant staff work all 7 days (consecutive-day flag)
- Weekend bar shifts include clopens with morning kitchen shifts
- Some employees approach or exceed their `weekly_hours_max`

Use `GET /api/schedules/:id/burnout-risks` for any published schedule.

---

## Reseeding

To reset and reseed the database:

```bash
# Stop the server, delete the DB file, restart
rm server/shiftsync.db
npm run dev   # from the repo root
```

The server calls `seedDemoData()` on startup and skips seeding if employees already exist.

To run seed validation independently:

```ts
import { validateSeedData } from './seed';
validateSeedData(); // throws if any integrity check fails
```

---

## API Endpoints (new in this release)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sites` | List all sites |
| `POST` | `/api/sites` | Create a site (manager only) |
| `GET` | `/api/sites/:id` | Get a single site |
| `GET` | `/api/sites/:id/employees` | Employees at a site |
| `GET` | `/api/overtime` | All overtime records (auth required) |
| `GET` | `/api/overtime/employee/:id` | Overtime for one employee |
