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

Every employee has a corresponding login:

| Username | Password | Role |
|----------|----------|------|
| `alice` | `password123` | Manager (Bella Napoli) |
| `iris` | `password123` | Manager (The Blue Door) |
| `quinn` | `password123` | Manager (Grand Pacific) |
| `yara` | `password123` | Manager (Seaside Suites) |
| `bob`, `carol`, … | `password123` | Employee |

> Managers set `is_manager = 1`; all others set `is_manager = 0`.
> Duplicate first names get a numeric suffix (e.g. `amy2`).

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
