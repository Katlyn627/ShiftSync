# ShiftSync Demo Dataset

This document describes the multi-site seed dataset included with ShiftSync.
The data is automatically loaded when the server starts against an **empty database**.

---

## Quick Login Reference

**All accounts use the password: `password123`**

### Managers (is_manager = 1)

| Username | Full Name | Site | Role Title |
|----------|-----------|------|------------|
| `alice` | Alice Johnson | Bella Napoli | General Manager |
| `marco` | Marco Romano | Bella Napoli | Assistant Manager |
| `iris` | Iris Taylor | The Blue Door | Restaurant Manager |
| `victor` | Victor Cruz | The Blue Door | Kitchen Manager |
| `quinn` | Quinn Lewis | Grand Pacific Hotel | General Manager |
| `patricia` | Patricia Williams | Grand Pacific Hotel | Asst General Manager |
| `benjamin` | Benjamin Foster | Grand Pacific Hotel | Director of Revenue |
| `stephanie` | Stephanie Cole | Grand Pacific Hotel | Director of HR |
| `michael` | Michael Torres | Grand Pacific Hotel | Director of Sales |
| `victor2` | Victor Lee | Grand Pacific Hotel | F&B Director |
| `xavier` | Xavier Brown | Grand Pacific Hotel | Front Office Manager |
| `hannah` | Hannah Park | Grand Pacific Hotel | Executive Housekeeper |
| `thomas` | Thomas Reed | Grand Pacific Hotel | Guest Services Manager |
| `anthony` | Anthony Rivera | Grand Pacific Hotel | Restaurant Manager |
| `christina` | Christina Park | Grand Pacific Hotel | Executive Chef |
| `robert` | Robert Miller | Grand Pacific Hotel | Banquet & Events Manager |
| `wendy` | Wendy Chen | Grand Pacific Hotel | Chief Engineer |
| `jonathan` | Jonathan Reed | Grand Pacific Hotel | Security Manager |
| `yara` | Yara Davis | Seaside Suites & Spa | General Manager |
| `william` | William Foster | Seaside Suites & Spa | Asst General Manager |
| `catherine` | Catherine Reyes | Seaside Suites & Spa | Financial Controller |
| `robert3` | Robert James | Seaside Suites & Spa | F&B Director |
| `steven2` | Steven Park | Seaside Suites & Spa | Director of Sales |
| `angela` | Angela Torres | Seaside Suites & Spa | Spa Director |
| `elena` | Elena Kim | Seaside Suites & Spa | Chief Engineer |
| `pamela` | Pamela Brooks | Seaside Suites & Spa | Front Office Manager |
| `clara` | Clara Nguyen | Seaside Suites & Spa | Executive Housekeeper |
| `carlos3` | Carlos Medina | Seaside Suites & Spa | Guest Services Manager |
| `felix` | Felix Garcia | Seaside Suites & Spa | Restaurant Manager |
| `victoria` | Victoria Park | Seaside Suites & Spa | Executive Chef |
| `noah2` | Noah Walsh | Seaside Suites & Spa | Pool Bar & Beach Manager |
| `richard` | Richard Thompson | Seaside Suites & Spa | Security Manager |
| `samantha` | Samantha Lee | Seaside Suites & Spa | Spa Manager |

### Representative General Employees

Pick one of these to test general employee views (no manager features):

| Username | Full Name | Site | Role |
|----------|-----------|------|------|
| `bob` | Bob Smith | Bella Napoli | Server (Lead) |
| `frank` | Frank Miller | Bella Napoli | Bar (Head Bartender) |
| `david` | David Brown | Bella Napoli | Kitchen (Executive Chef) |
| `jack` | Jack Anderson | The Blue Door | Server (Lead) |
| `noah` | Noah Harris | The Blue Door | Bar (Head Bartender) |
| `rachel` | Rachel Scott | Grand Pacific Hotel | Front Desk (Supervisor) |
| `sam` | Sam Turner | Grand Pacific Hotel | Front Desk (Night Audit) |
| `uma` | Uma Johnson | Grand Pacific Hotel | Housekeeping (Supervisor) |
| `zach` | Zach Wilson | Seaside Suites & Spa | Front Desk (Supervisor) |
| `amy` | Amy Taylor | Seaside Suites & Spa | Front Desk (Night Audit) |
| `ben` | Ben Martinez | Seaside Suites & Spa | Housekeeping |
| `dan` | Dan Roberts | Seaside Suites & Spa | F&B (Lead Server) |

---

## Sites (4 total)

| # | Name | City, State | Type | Timezone |
|---|------|-------------|------|----------|
| 1 | Bella Napoli | Chicago, IL | Restaurant | America/Chicago |
| 2 | The Blue Door | Austin, TX | Restaurant | America/Chicago |
| 3 | Grand Pacific Hotel | New York, NY | Hotel | America/New_York |
| 4 | Seaside Suites & Spa | Miami, FL | Hotel | America/New_York |

---

## Employees (~240 total)

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
Manager · Front Desk · Housekeeping · Kitchen · F&B · Bar · Concierge · Maintenance · Security · Spa

---

## Users / Authentication

Every employee has a corresponding login. **Password is `password123` for all accounts.**

Usernames are derived from the employee's first name (lowercased). Duplicate first names across all sites receive a numeric suffix starting at `2` (e.g., the second `Jake` becomes `jake2`).

### Site 1 — Bella Napoli (Restaurant, Chicago IL) · ~25 employees

#### Managers
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `alice` ⭐ | Alice Johnson | General Manager | $24.00 |
| `marco` ⭐ | Marco Romano | Assistant Manager | $22.00 |

#### Kitchen
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `david` | David Brown | Executive Chef | $24.00 |
| `eve` | Eve Davis | Sous Chef | $19.00 |
| `jake` | Jake Parker | Head Line Cook | $18.00 |
| `sofia` | Sofia Reyes | Line Cook | $16.50 |
| `tyler` | Tyler Brooks | Line Cook | $16.00 |
| `natalie` | Natalie Green | Prep Cook | $15.00 |
| `marcus` | Marcus White | Prep Cook | $15.00 |
| `owen` | Owen Hall | Dishwasher | $13.00 |
| `ruby` | Ruby Adams | Dishwasher | $13.00 |

#### Servers
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `bob` | Bob Smith | Lead Server | $14.00 |
| `carol` | Carol White | Server | $13.50 |
| `henry` | Henry Moore | Server | $13.50 |
| `diana` | Diana Prince | Server | $13.50 |
| `ethan` | Ethan Ross | Server | $13.00 |
| `fiona` | Fiona Bell | Server | $13.00 |
| `george` | George Hill | Server | $13.00 |
| `amanda` | Amanda Fox | Server | $13.00 |

#### Bar
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `frank` | Frank Miller | Head Bartender | $17.50 |
| `lily` | Lily Turner | Bartender | $15.50 |
| `oliver` | Oliver Park | Barback | $13.00 |

#### Host
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `grace` | Grace Wilson | Lead Host | $13.00 |
| `hazel` | Hazel Price | Host | $12.50 |
| `isaac` | Isaac Reed | Busser | $12.50 |

---

### Site 2 — The Blue Door (Restaurant, Austin TX) · ~24 employees

#### Managers
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `iris` ⭐ | Iris Taylor | Restaurant Manager | $23.00 |
| `victor` ⭐ | Victor Cruz | Kitchen Manager | $21.00 |

#### Kitchen
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `liam` | Liam Jackson | Sous Chef | $19.00 |
| `mia` | Mia Robinson | Line Cook | $17.00 |
| `carlos` | Carlos Rivera | Line Cook | $16.50 |
| `amber` | Amber Chen | Line Cook | $16.00 |
| `dylan` | Dylan Murphy | Prep Cook | $14.50 |
| `sara` | Sara Wilson | Prep Cook | $14.50 |
| `jake2` | Jake Torres | Dishwasher | $13.00 |
| `emma` | Emma Walsh | Dishwasher | $13.00 |
| `nathan` | Nathan Bell | Pastry Cook | $17.00 |

#### Servers
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `jack` | Jack Anderson | Lead Server | $13.50 |
| `karen` | Karen Thomas | Senior Server | $14.50 |
| `peter` | Peter Clark | Server | $13.00 |
| `bella` | Bella Scott | Server | $13.00 |
| `christopher` | Christopher Evans | Server | $12.50 |
| `maria` | Maria Santos | Server | $12.50 |
| `daniel` | Daniel Kim | Server | $12.50 |

#### Host
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `olivia` | Olivia Martin | Lead Host | $12.50 |
| `ryan` | Ryan Lee | Host | $12.00 |
| `sophie` | Sophie Green | Busser | $12.00 |

#### Bar
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `noah` | Noah Harris | Head Bartender | $16.00 |
| `zoe` | Zoe Walker | Bartender | $15.00 |
| `alex` | Alex Morgan | Barback | $12.50 |

---

### Site 3 — Grand Pacific Hotel (Hotel, New York NY) · ~95 employees

#### Managers
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `quinn` ⭐ | Quinn Lewis | General Manager | $38.00 |
| `patricia` ⭐ | Patricia Williams | Asst General Manager | $34.00 |
| `benjamin` ⭐ | Benjamin Foster | Director of Revenue | $32.00 |
| `stephanie` ⭐ | Stephanie Cole | Director of HR | $30.00 |
| `michael` ⭐ | Michael Torres | Director of Sales | $31.00 |
| `victor2` ⭐ | Victor Lee | F&B Director | $32.00 |
| `xavier` ⭐ | Xavier Brown | Front Office Manager | $28.00 |
| `hannah` ⭐ | Hannah Park | Executive Housekeeper | $26.00 |
| `thomas` ⭐ | Thomas Reed | Guest Services Manager | $27.00 |
| `anthony` ⭐ | Anthony Rivera | Restaurant Manager | $26.00 |
| `christina` ⭐ | Christina Park | Executive Chef | $28.00 |
| `robert` ⭐ | Robert Miller | Banquet & Events Manager | $26.00 |
| `wendy` ⭐ | Wendy Chen | Chief Engineer | $28.00 |
| `jonathan` ⭐ | Jonathan Reed | Security Manager | $27.00 |

#### Front Desk / Front Office
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `rachel` | Rachel Scott | Front Desk Supervisor | $22.00 |
| `sam` | Sam Turner | Night Audit Supervisor | $23.00 |
| `laura` | Laura Kim | Front Desk Agent | $18.50 |
| `marcus2` | Marcus Johnson | Front Desk Agent | $18.00 |
| `emma2` | Emma Davis | Front Desk Agent | $18.00 |
| `jason` | Jason Chen | Night Auditor | $20.00 |
| `olivia2` | Olivia Brown | Front Desk Agent | $17.50 |
| `ethan2` | Ethan Wilson | Night Auditor | $19.50 |
| `lily2` | Lily Park | Front Desk Agent | $17.50 |
| `sophia` | Sophia Martinez | Head Concierge | $22.00 |
| `james` | James Anderson | Concierge | $19.50 |
| `natalie2` | Natalie Taylor | Concierge | $19.00 |
| `robert2` | Robert Hall | Bell Captain | $20.00 |
| `daniel2` | Daniel Kim | Bellhop | $17.00 |
| `andrew` | Andrew Garcia | Reservations Coordinator | $18.00 |
| `barbara2` | Barbara Martinez | Accounting Clerk | $18.00 |
| `tim` | Tim Cooper | Night Porter | $16.50 |

#### Housekeeping
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `uma` | Uma Johnson | Housekeeping Supervisor | $21.50 |
| `tina` | Tina Mitchell | Floor Supervisor | $19.00 |
| `jennifer` | Jennifer Lee | Floor Supervisor | $19.00 |
| `maria2` | Maria Garcia | Housekeeping Inspector | $18.00 |
| `ana` | Ana Lopez | Room Attendant | $16.50 |
| `rosa` | Rosa Martinez | Room Attendant | $16.50 |
| `linda` | Linda Chen | Room Attendant | $16.50 |
| `diana2` | Diana Park | Room Attendant | $16.50 |
| `julie` | Julie Brown | Room Attendant | $16.00 |
| `sarah` | Sarah White | Room Attendant | $16.00 |
| `jessica` | Jessica Davis | Room Attendant | $16.00 |
| `amanda2` | Amanda Wilson | Room Attendant | $16.00 |
| `kathy` | Kathy Taylor | Room Attendant | $16.00 |
| `nancy` | Nancy Rodriguez | Room Attendant | $16.00 |
| `barbara` | Barbara Collins | Room Attendant | $15.50 |
| `sandra` | Sandra Phillips | Room Attendant | $15.50 |
| `dorothy` | Dorothy Thompson | Laundry Supervisor | $18.00 |
| `helen` | Helen Martinez | Laundry Attendant | $15.00 |
| `carol2` | Carol Parker | Public Area Cleaner | $15.00 |
| `margaret` | Margaret Evans | Public Area Cleaner | $15.00 |

#### Kitchen
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `david2` | David Nguyen | Sous Chef | $23.00 |
| `alice2` | Alice Park | Head Line Cook | $19.00 |
| `kevin` | Kevin Torres | Line Cook | $17.50 |
| `michelle` | Michelle Kim | Line Cook | $17.00 |
| `brian` | Brian Johnson | Prep Cook | $15.50 |
| `christine` | Christine Adams | Prep Cook | $15.50 |
| `steven` | Steven White | Dishwasher | $14.00 |
| `george2` | George Martinez | Dishwasher | $14.00 |
| `patricia2` | Patricia Morris | Pastry Chef | $20.00 |

#### F&B / Bar / Banquet
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `tommy` | Tommy Chen | Lead Server | $17.00 |
| `ashley` | Ashley Davis | Server | $15.00 |
| `brandon` | Brandon Wilson | Server | $14.50 |
| `megan` | Megan Taylor | Server | $14.50 |
| `kyle` | Kyle Martin | Server | $14.00 |
| `lauren` | Lauren Anderson | Server | $14.00 |
| `nicole` | Nicole Thomas | Hostess | $16.00 |
| `rachel2` | Rachel Clark | Hostess | $15.50 |
| `jason2` | Jason Lee | Head Bartender | $20.00 |
| `brittany` | Brittany Johnson | Bartender | $17.00 |
| `ryan2` | Ryan Martinez | Bartender | $17.00 |
| `amber2` | Amber Wilson | Bar Server | $15.00 |
| `carlos2` | Carlos Garcia | Barback | $13.50 |
| `rebecca` | Rebecca Torres | Banquet Captain | $21.00 |
| `christopher2` | Christopher Kim | Banquet Server | $15.00 |
| `teresa` | Teresa Martinez | Banquet Server | $15.00 |
| `marcus3` | Marcus Brown | Banquet Server | $15.00 |
| `katelyn` | Katelyn Davis | Event Coordinator | $19.00 |

#### Engineering / Maintenance
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `frank2` | Frank Torres | Senior Maintenance Tech | $22.00 |
| `gary` | Gary Anderson | Maintenance Technician | $20.50 |
| `harold` | Harold Wilson | Electrical/HVAC Technician | $22.00 |
| `irene` | Irene Park | Facilities Coordinator | $18.00 |

#### Security
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `patricia3` | Patricia Lee | Security Officer | $18.00 |
| `michael2` | Michael Brown | Security Officer | $18.00 |
| `sandra2` | Sandra Collins | Security Officer | $17.50 |

#### Spa
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `amy` | Amy Foster | Spa & Recreation Manager | $22.00 |
| `crystal` | Crystal Park | Massage Therapist | $20.00 |
| `monica` | Monica Brown | Fitness Attendant | $16.00 |
| `kevin2` | Kevin Ross | Pool Attendant | $15.00 |

---

### Site 4 — Seaside Suites & Spa (Hotel, Miami FL) · ~87 employees

#### Managers
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `yara` ⭐ | Yara Davis | General Manager | $36.00 |
| `william` ⭐ | William Foster | Asst General Manager | $32.00 |
| `catherine` ⭐ | Catherine Reyes | Financial Controller | $30.00 |
| `robert3` ⭐ | Robert James | F&B Director | $31.00 |
| `steven2` ⭐ | Steven Park | Director of Sales | $29.00 |
| `angela` ⭐ | Angela Torres | Spa Director | $28.00 |
| `elena` ⭐ | Elena Kim | Chief Engineer | $27.00 |
| `pamela` ⭐ | Pamela Brooks | Front Office Manager | $26.00 |
| `clara` ⭐ | Clara Nguyen | Executive Housekeeper | $25.00 |
| `carlos3` ⭐ | Carlos Medina | Guest Services Manager | $25.00 |
| `felix` ⭐ | Felix Garcia | Restaurant Manager | $25.00 |
| `victoria` ⭐ | Victoria Park | Executive Chef | $27.00 |
| `noah2` ⭐ | Noah Walsh | Pool Bar & Beach Manager | $24.00 |
| `richard` ⭐ | Richard Thompson | Security Manager | $25.00 |
| `samantha` ⭐ | Samantha Lee | Spa Manager | $23.00 |

#### Front Desk / Front Office
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `zach` | Zach Wilson | Front Desk Supervisor | $22.00 |
| `amy2` | Amy Taylor | Night Audit Supervisor | $22.50 |
| `jennifer2` | Jennifer Moore | Front Desk Agent | $18.00 |
| `kevin3` | Kevin Park | Front Desk Agent | $17.50 |
| `melissa` | Melissa Torres | Front Desk Agent | $17.50 |
| `anthony2` | Anthony Kim | Night Auditor | $19.50 |
| `rachel3` | Rachel Brooks | Front Desk Agent | $17.00 |
| `nathan2` | Nathan Chen | Night Auditor | $19.00 |
| `isabella` | Isabella Rodriguez | Head Concierge | $21.00 |
| `patrick` | Patrick Wilson | Concierge | $19.00 |
| `sophie2` | Sophie Lee | Concierge | $18.50 |
| `marco2` | Marco Hernandez | Bell Captain | $20.00 |
| `jasmine` | Jasmine Taylor | Bellhop | $16.50 |

#### Housekeeping
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `maria3` | Maria Santos | Housekeeping Supervisor | $20.50 |
| `diana3` | Diana Park | Floor Supervisor | $18.50 |
| `lisa` | Lisa Wang | Floor Supervisor | $18.50 |
| `ben` | Ben Martinez | Room Attendant | $16.00 |
| `patricia4` | Patricia Cruz | Room Attendant | $16.00 |
| `carmen` | Carmen Lopez | Room Attendant | $16.00 |
| `rosa2` | Rosa Chen | Room Attendant | $16.00 |
| `sandra3` | Sandra Torres | Room Attendant | $15.50 |
| `linda2` | Linda Kim | Room Attendant | $15.50 |
| `kathy2` | Kathy Martinez | Room Attendant | $15.50 |
| `nancy2` | Nancy Wilson | Room Attendant | $15.50 |
| `barbara3` | Barbara Davis | Room Attendant | $15.00 |
| `dorothy2` | Dorothy Evans | Room Attendant | $15.00 |
| `helen2` | Helen Brooks | Room Attendant | $15.00 |
| `christine2` | Christine Santos | Laundry Supervisor | $17.50 |
| `teresa2` | Teresa Lopez | Laundry Attendant | $15.00 |
| `carlos4` | Carlos Rivera | Public Area Cleaner | $14.50 |
| `marcus4` | Marcus Reed | Public Area Cleaner | $14.50 |

#### Kitchen
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `antonio` | Antonio Reyes | Sous Chef | $22.00 |
| `priya` | Priya Sharma | Line Cook | $17.00 |
| `tyler2` | Tyler Johnson | Line Cook | $16.50 |
| `mandy` | Mandy Chen | Line Cook | $16.50 |
| `jose` | Jose Rodriguez | Prep Cook | $15.00 |
| `melissa2` | Melissa Wong | Prep Cook | $15.00 |
| `eric` | Eric Martinez | Dishwasher | $13.50 |
| `tammy` | Tammy Brown | Dishwasher | $13.50 |

#### F&B / Bar / Pool
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `dan` | Dan Roberts | Lead Server | $17.00 |
| `stephanie2` | Stephanie Wilson | Server | $14.50 |
| `michael3` | Michael Rivera | Server | $14.50 |
| `karen2` | Karen Park | Server | $14.00 |
| `thomas2` | Thomas Chen | Server | $14.00 |
| `aisha` | Aisha Johnson | Server | $13.50 |
| `roberto` | Roberto Martinez | Host | $15.50 |
| `nadia` | Nadia Kim | Hostess | $15.00 |
| `sofia2` | Sofia Hernandez | Head Bartender (Pool Bar) | $17.00 |
| `jackson` | Jackson Lee | Bartender (Pool Bar) | $16.50 |
| `daisy` | Daisy Chen | Poolside Server | $13.50 |
| `chris` | Chris Park | Beach Service Attendant | $13.50 |
| `emma3` | Emma Thompson | Poolside Server | $13.50 |

#### Spa
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `crystal2` | Crystal Park | Massage Therapist | $21.00 |
| `brandon2` | Brandon Davis | Massage Therapist | $21.00 |
| `grace2` | Grace Kim | Esthetician | $20.00 |
| `victoria2` | Victoria Santos | Nail Technician | $18.50 |
| `jason3` | Jason Chen | Fitness Director | $20.00 |
| `tiffany` | Tiffany Brown | Yoga & Fitness Instructor | $18.00 |

#### Engineering / Maintenance
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `paul` | Paul Martinez | Senior Maintenance Tech | $21.50 |
| `victor3` | Victor Santos | Maintenance Technician | $20.00 |
| `diana4` | Diana Torres | Electrical/HVAC Technician | $21.00 |
| `james2` | James Park | Facilities Coordinator | $17.50 |

#### Security
| Username | Full Name | Role Title | Hourly Rate |
|----------|-----------|------------|-------------|
| `carlos5` | Carlos Davis | Security Officer | $18.00 |
| `maria4` | Maria Lopez | Security Officer | $18.00 |
| `kevin4` | Kevin Brown | Security Officer | $17.00 |

> ⭐ = `is_manager = 1` (full manager access to all dashboard features)
>
> Username collisions across sites are resolved with a numeric suffix starting at `2`
> (e.g., the second `Jake` → `jake2`, the third `Alice` → `alice2`).

---

## Schedules

Each site gets **2 weekly schedules**:

| Week | Status |
|------|--------|
| Prior week (Mon –7) | `published` |
| Current week (Mon +0) | `draft` |

Labor budgets:
- Bella Napoli: $14,000 / week
- The Blue Door: $11,000 / week
- Grand Pacific Hotel: $58,000 / week
- Seaside Suites & Spa: $44,000 / week

---

## Shifts

Shifts are seeded for all 7 days of each schedule.

### Restaurant shift pattern
| Role | Shift |
|------|-------|
| Manager | 09:00 – 17:00 |
| Server | 11:00 – 15:00 (lunch) |
| Server | 16:00 – 22:00 (dinner) |
| Kitchen | 09:00 – 17:00 |
| Kitchen | 15:00 – 23:00 |
| Bar | 16:00 – 23:30 (weekday) |
| **Bar** | **16:00 – 01:00** (**overnight Fri/Sat**) |
| Host | 11:00 – 19:00 |

### Hotel shift pattern (24-hour coverage)
| Role | Shift |
|------|-------|
| Manager | 08:00 – 16:00 |
| Front Desk (day) | 07:00 – 15:00 |
| Front Desk (evening) | 15:00 – 23:00 |
| **Front Desk (night)** | **23:00 – 07:00** (**overnight**) |
| Housekeeping (majority) | 08:00 – 16:00 |
| Housekeeping (afternoon) | 12:00 – 20:00 |
| Kitchen (breakfast) | 06:00 – 14:00 |
| Kitchen (dinner) | 14:00 – 22:00 |
| F&B (breakfast) | 06:00 – 14:00 |
| F&B (dinner) | 14:00 – 22:00 |
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

## Shift Swap Requests

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

## Burnout Survey Campaigns

Three validated instruments are seeded across sites:

| Instrument | Site | Status | Notes |
|-----------|------|--------|-------|
| BAT | Grand Pacific Hotel | closed | Annual survey, high response rate |
| CBI | Grand Pacific Hotel | active | Q1 2025 Staff Burnout Assessment |
| OLBI | Seaside Suites & Spa | closed | Post-Holiday Season check |
| BAT | Seaside Suites & Spa | active | Spring 2025 Burnout Assessment |
| CBI | Bella Napoli | closed | Restaurant burnout baseline |
| OLBI | The Blue Door | active | Ongoing quarterly check |

Managers access aggregate + individual results; employees only see their own score.

---

## Burnout Risk Data (Schedule-based)

The prior week's shift data is designed to produce meaningful burnout output:
- Hotel night auditors work overnight shifts → **late-night flag**
- Some restaurant staff work all 7 days → **consecutive-day flag**
- Weekend bar shifts include clopens with morning kitchen shifts → **clopen flag**
- Some employees approach or exceed their `weekly_hours_max`

Use `GET /api/schedules/:id/burnout-risks` for any published schedule.

**Note:** Managers receive the full array of individual burnout records. General employees receive only their own record plus an anonymised aggregate summary (to prevent re-identification on small teams).

---

## Reseeding

To reset and reseed the database:

```bash
# Stop the server, delete the DB file, restart
rm server/shiftsync.db
npm run dev   # from the repo root
```

The server calls `seedDemoData()` on startup and skips seeding if employees already exist.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login (returns JWT) |
| `GET` | `/api/sites` | List all sites |
| `GET` | `/api/sites/:id` | Get a single site |
| `GET` | `/api/sites/:id/employees` | Employees at a site |
| `GET` | `/api/employees` | All employees (auth required) |
| `GET` | `/api/schedules` | List schedules for the authenticated user's site |
| `GET` | `/api/schedules/:id/burnout-risks` | Burnout risks (managers: full list; employees: own + summary) |
| `GET` | `/api/schedules/:id/labor-cost` | Labor cost summary (manager only) |
| `GET` | `/api/overtime` | All overtime records (auth required) |
| `GET` | `/api/overtime/employee/:id` | Overtime for one employee |
| `GET` | `/api/surveys/templates` | List burnout survey instruments |
| `GET` | `/api/surveys/campaigns` | List survey campaigns (manager: all; employee: own site) |
