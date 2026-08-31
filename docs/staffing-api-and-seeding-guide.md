# Staffing API and Realistic Seed Data Guide

This guide shows how to make staffing recommendations and seed data that are closer to current real-world demand patterns.

## 1) Staffing API design

### Endpoint shape
- `GET /api/schedules/staffing-suggestions?week_start=YYYY-MM-DD`
- Return one object per day with demand and role-level staffing needs.

Example response:

```json
[
  {
    "date": "2026-09-07",
    "day_of_week": 1,
    "expected_revenue": 6400,
    "expected_covers": 205,
    "staffing": [
      { "role": "Server", "start": "11:00", "end": "19:00", "count": 3 },
      { "role": "Server", "start": "15:00", "end": "23:00", "count": 2 },
      { "role": "Bartender", "start": "14:00", "end": "22:00", "count": 2 },
      { "role": "Host", "start": "10:00", "end": "18:00", "count": 1 }
    ]
  }
]
```

### What to model
- Day-of-week seasonality (weekday vs weekend)
- Hourly demand curves (lunch/dinner and local peak windows)
- Site type (restaurant, hotel, retail)
- Check size and conversion rates
- Event and holiday uplift
- Local weather sensitivity (optional but high value)

### Baseline formula pattern
- `expected_covers = f(previous_sales, seasonality, events, weather)`
- `role_count = ceil(expected_workload / productivity_per_role)`

## 2) Role-level variance (what causes under/over staffing)

For each day and role:
- `delta = actual_assigned_count - suggested_count`
- `delta < 0` means understaffed role.
- `delta > 0` means overstaffed role.

Store or compute this for UI and reporting so managers can see exact causes like:
- `Server -2`
- `Bartender +1`

## 3) Seed data that matches modern demographics

Do not guess demographics from stereotypes. Instead, calibrate with public statistics and your own historical data.

### Data sources to use
- U.S. Census and ACS for population and household distributions
- Bureau of Labor Statistics (BLS) for labor and occupation trends
- Local tourism or city open data portals
- Your historical POS and reservation data

### Seed dimensions to include
- Site market profile: downtown, suburban, campus, tourism corridor
- Customer mix by daypart: workers, families, nightlife, visitors
- Role mix by market: server/host/bar/boh ratios
- Wage bands by geography
- Weekly availability constraints by role and tenure

### Practical seeding recipe
1. Define site archetypes (for example: downtown fast casual, neighborhood full service, nightlife bar).
2. Assign each archetype a demand curve by weekday and daypart.
3. Generate 12-24 months of synthetic forecasts with trend + seasonality + random noise.
4. Generate employees by role distribution per site archetype.
5. Seed availability and preferred shift windows per role.
6. Validate outputs against target KPIs:
   - labor percent range
   - average covers per server
   - overtime rate
   - open-shift frequency

## 4) Accuracy checks to run every seed refresh

- Compare synthetic distributions to real monthly medians and percentiles.
- Check role utilization by weekday and daypart.
- Ensure understaffed and overstaffed days are both present but not extreme.
- Run backtests: feed seeded forecasts into scheduler and compare produced staffing to target labor KPIs.

## 5) Next iteration suggestions

- Add a role productivity table by site and daypart.
- Add event calendar multipliers.
- Add confidence intervals to daily recommendations so UI can show risk bands.
