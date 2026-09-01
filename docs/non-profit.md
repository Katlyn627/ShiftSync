# Humanitarian & Non-Profit Organization: Seed Data Roster

This seed dataset is structured for seeding a non-profit / humanitarian operations scheduling application. It includes department schemas, roles, full-time/part-time staff, hourly contractors, management, grant specialists, child development experts, and an active volunteer roster with realistic shift availabilities, skills, and compensation bands.

## Seed Version & Primary QA Path

- Seed version: 2026.08.31-humanitarian-primary-v3
- This file is the source of truth for the humanitarian seed scenario.
- Primary test business: Global Impact Initiative (nonprofit/humanitarian).
- All seeded accounts use password: password123

### Primary Humanitarian Test Credentials

| Username | Access | Site | Role Title |
|---|---|---|---|
| gii_ceo | Manager | Global Impact Initiative | Chief Executive Officer |
| gii_ipm | Manager | Global Impact Initiative | International Program Manager |
| gii_programofficer | Manager | Global Impact Initiative | Program Officer - Girls Education and Empowerment |
| gii_fieldlead | Employee | Global Impact Initiative | Field Coordinator |

---

## 1. Department Overview & Structure

| Department Code | Department Name | Head of Department | Core Operational Focus | Typical Shift Schedule |
|---|---|---|---|---|
| **EXEC** | Executive Leadership | Chief Executive Officer | Strategic governance, board liaison, compliance | Standard (Mon–Fri 8:30 AM – 5:00 PM) |
| **PROG-CD** | Child Development & Youth Services | Director of Youth & Family Programs | Early childhood care, after-school mentorship, trauma-informed child development | Split / Extended (Mon–Sat 7:30 AM – 6:30 PM) |
| **HUM-OPS** | Humanitarian Aid & Emergency Relief | Director of Field Operations | Rapid relief dispatch, food pantry, shelter ops, emergency logistics | 24/7 Rotational / On-Call / 3-Shift System |
| **DEV-GRANT**| Development & Grant Management | Director of Institutional Giving | Grant writing, donor stewardship, reporting, major gifts | Standard / Event-Based Evenings |
| **COMM-VOL** | Volunteer & Community Engagement | Volunteer Operations Manager | Volunteer intake, vetting, shift allocation, outreach | Flexible / Weekend-heavy |
| **CLIN-CARE**| Community Health & Psycho-Social Support | Clinical Services Director | Mobile clinics, mental health triage, counseling, first aid | Shift-Based (Mon–Fri 8:00 AM – 7:00 PM) |
| **FIN-ADMIN**| Finance, HR & Administrative Ops | VP of Finance & People | Payroll, audit compliance, facilities, scheduling coordination | Standard (Mon–Fri 9:00 AM – 5:00 PM) |

---

## 2. Comprehensive Employee & Staff Roster

### Management & Executive Staff

| ID | Full Name | Title | Department | Employment Type | Annual Salary / Base Rate | Primary Shift | Key Certifications / Qualifications |
|---|---|---|---|---|---|---|---|
| `EMP-1001` | **Dr. Marcus Vance** | Chief Executive Officer | `EXEC` | Full-Time (Exempt) | $145,000 / yr | Mon-Fri 08:30–17:00 | Ph.D. Non-Profit Mgmt, PMP |
| `EMP-1002` | **Elena Rostova** | VP of Finance & Human Capital | `FIN-ADMIN` | Full-Time (Exempt) | $118,000 / yr | Mon-Fri 09:00–17:00 | CPA, SHRM-SCP |
| `EMP-1003` | **Tariq Al-Mansoor** | Director of Field Operations | `HUM-OPS` | Full-Time (Exempt) | $105,000 / yr | On-Call / Rotational | FEMA ICS-400, CDL-B, Wilderness First Responder |
| `EMP-1004` | **Camila O'Connor** | Director of Youth & Family Programs | `PROG-CD` | Full-Time (Exempt) | $98,000 / yr | Mon-Fri 08:00–16:30 | MSW, LCSW, Early Childhood Licensure |
| `EMP-1005` | **Dr. Aris Thorne** | Clinical Services Director | `CLIN-CARE` | Full-Time (Exempt) | $125,000 / yr | Mon-Fri 08:30–17:00 | MD / Public Health, Board Certified |
| `EMP-1006` | **Diane Moreau** | Director of Institutional Giving | `DEV-GRANT` | Full-Time (Exempt) | $96,000 / yr | Mon-Fri 09:00–17:00 | CFRE (Certified Fundraising Executive) |
| `EMP-1007` | **Malik Washington** | Volunteer Operations Manager | `COMM-VOL` | Full-Time (Exempt) | $72,000 / yr | Tue-Sat 09:00–17:30 | CVA (Certified in Volunteer Administration) |

---

### Program, Field & Technical Specialists

| ID | Full Name | Title | Department | Type | Comp. Rate | Standard Hours / Week | Shift Pattern | Skills & Certifications |
|---|---|---|---|---|---|---|---|---|
| `EMP-2001` | **Siddharth Mehta** | Senior Grant Writing Specialist | `DEV-GRANT` | Full-Time | $78,000 / yr | 40 hrs | Mon-Fri 08:30–17:00 | Federal Grants (Grants.gov), Foundation Relations |
| `EMP-2002` | **Brianna Jackson** | Institutional Grant Coordinator | `DEV-GRANT` | Full-Time | $58,000 / yr | 40 hrs | Mon-Fri 09:00–17:00 | Grant Compliance, Financial Reporting, Budgeting |
| `EMP-2003` | **Nia Kimani** | Lead Child Development Specialist | `PROG-CD` | Full-Time | $66,000 / yr | 40 hrs | Mon-Fri 07:30–16:00 | Trauma-Informed Care, CPR/AED Infant & Adult |
| `EMP-2004` | **Mateo Hernandez** | Child Development Specialist | `PROG-CD` | Full-Time | $52,000 / yr | 40 hrs | Mon-Fri 10:00–18:30 | Bilingual (ES/EN), Early Intervention Specialist |
| `EMP-2005` | **Chloe Nguyen** | Youth Mentorship Program Coordinator | `PROG-CD` | Full-Time | $49,000 / yr | 40 hrs | Mon-Fri 09:30–18:00 | Youth Behavioral Support, Mentorship Curriculum |
| `EMP-2006` | **Kofi Achebe** | Emergency Logistics Program Manager | `HUM-OPS` | Full-Time | $74,000 / yr | 40 hrs + On-Call | Rotational Shift (A/B) | Supply Chain Mgmt, HazMat Handler, Forklift Cert |
| `EMP-2007` | **Hannah Lindqvist** | Relief Aid Dispatch Coordinator | `HUM-OPS` | Full-Time | $48,000 / yr | 40 hrs | Mon-Fri 06:00–14:30 | Fleet Routing, Multilingual (EN/FR/AR), Radio Ops |
| `EMP-2008` | **David O'Reilly** | Warehouse & Distribution Lead | `HUM-OPS` | Full-Time | $24.50 / hr | 40 hrs | Mon-Fri 07:00–15:30 | Inventory ERP, OSHA 30-Hour, Heavy Equipment |
| `EMP-2009` | **Amina Kassem** | Mobile Clinic Nurse Lead | `CLIN-CARE` | Full-Time | $82,000 / yr | 40 hrs | Tue-Sat 08:00–16:30 | RN, BLS/ACLS, Disaster Triage (START) |
| `EMP-2010` | **Jordan Alvarez** | Bilingual Mental Health Case Worker | `CLIN-CARE` | Full-Time | $56,000 / yr | 40 hrs | Mon-Fri 09:00–17:30 | MSW, Crisis De-escalation, Mental Health First Aid |
| `EMP-2011` | **Rachel Gold** | Volunteer Onboarding Coordinator | `COMM-VOL` | Full-Time | $46,000 / yr | 40 hrs | Tue-Sat 08:30–17:00 | Background Screening, Vetting, LMS Administration |
| `EMP-2012` | **Samuel Chen** | Field Operations Dispatcher | `HUM-OPS` | Part-Time | $22.00 / hr | 24 hrs | Thu-Sat 14:00–22:30 | GIS Mapping, Crisis Communications |
| `EMP-2013` | **Lucia Duarte** | After-School Child Care Specialist | `PROG-CD` | Part-Time | $21.50 / hr | 20 hrs | Mon-Fri 14:00–18:00 | Pediatric First Aid, Mandated Reporter Certified |
| `EMP-2014` | **Trevor Vance** | Relief Food Pantry Supervisor | `HUM-OPS` | Part-Time | $20.00 / hr | 25 hrs | Wed-Sun 09:00–14:30 | ServSafe Food Protection Manager, Food Safety QA |

---

## 3. Dedicated Volunteer Roster

Volunteers require shift tracking, credential verification, background checks, emergency contact data, and tiered qualification levels.

| Volunteer ID | Name | Volunteer Role Tier | Assigned Department | Weekly Availability | Max Hrs / Wk | Background Check | Certifications / Specialties |
|---|---|---|---|---|---|---|---|
| `VOL-3001` | **Grace Kelly Lin** | Senior Volunteer Facilitator | `COMM-VOL` / `HUM-OPS` | Weekends (Sat/Sun 08:00–16:00) | 16 hrs | Cleared (Level 2) | First Aid/CPR, Event Lead, Driver |
| `VOL-3002` | **Devon Miller** | Youth Activities Assistant | `PROG-CD` | Mon, Wed, Fri (15:00–18:30) | 12 hrs | Cleared (Child FBI/DOJ) | Pediatric First Aid, Tutoring (Math/STEM) |
| `VOL-3003` | **Soraya Haddad** | Translation & Intake Volunteer | `HUM-OPS` / `CLIN-CARE` | Tue, Thu (09:00–15:00) | 12 hrs | Cleared (Standard) | Fluent Arabic/French/English, HIPAA Trained |
| `VOL-3004` | **Lucas Becker** | Food Distribution Associate | `HUM-OPS` | Saturdays (07:30–14:00) | 8 hrs | Cleared (Standard) | Food Handler Card, Pallet Jack Operator |
| `VOL-3005` | **Fatima Zahra** | Early Learning & Playroom Aide | `PROG-CD` | Mon-Thu (09:00–13:00) | 16 hrs | Cleared (Child FBI/DOJ) | Art Therapy Assistant, Early Childhood Educator |
| `VOL-3006` | **Patrick Gallagher**| Emergency Shelter Night Steward | `HUM-OPS` | Fri-Sun Nights (20:00–04:00) | 24 hrs | Cleared (Level 2) | Trauma-Informed Care, De-escalation |
| `VOL-3007` | **Yuki Tanaka** | Grant Research Intern | `DEV-GRANT` | Flexible Remote (10 hrs/wk) | 10 hrs | Cleared (Standard) | Foundation Directory Online, Data Visualization |
| `VOL-3008` | **Mei-Ling Zhou** | Mobile Health Clinic Navigator | `CLIN-CARE` | Wednesdays (08:00–16:00) | 8 hrs | Cleared (Standard) | Medical Translation (Mandarin), HIPAA Trained |
| `VOL-3009` | **Jamal Crawford** | Youth Sports & Fitness Mentor | `PROG-CD` | Sat mornings (08:30–13:00) | 5 hrs | Cleared (Child FBI/DOJ) | CPR/AED, Youth Coaching Credential |
| `VOL-3010` | **Isabella Rossi** | Disaster Kit Assembly Lead | `HUM-OPS` | Thursdays (12:00–17:00) | 5 hrs | Cleared (Standard) | Inventory & Supply Packing Specialist |

---

## 4. Shift Scheduling Slots & Recurring Schedules

Use these standard shift definitions for auto-generating recurring slots across departments:

### Department Shift Matrix

| Shift Code | Shift Name | Start Time | End Time | Target Department | Required Roles / Headcount |
|---|---|---|---|---|---|
| `SHF-CD-MORN` | Early Childhood Care & Intake | 07:30 AM | 12:30 PM | `PROG-CD` | 1 Lead Specialist (`EMP-2003`), 2 Specialists (`EMP-2004`, `VOL-3005`) |
| `SHF-CD-AFTN` | Youth After-School Mentoring | 01:30 PM | 06:30 PM | `PROG-CD` | 1 Coordinator (`EMP-2005`), 1 Child Care Spec (`EMP-2013`), 2 Volunteers (`VOL-3002`) |
| `SHF-FD-DIST` | Community Food Pantry Operations | 08:00 AM | 02:00 PM | `HUM-OPS` | 1 Supervisor (`EMP-2014`), 1 Logistics Lead (`EMP-2008`), 4 Volunteers (`VOL-3004`, `VOL-3001`) |
| `SHF-REL-DISP`| Emergency Relief Rapid Dispatch | 06:00 AM | 02:30 PM | `HUM-OPS` | 1 Dispatcher (`EMP-2007`), 1 Field Manager (`EMP-2006`) |
| `SHF-MOB-HLTH`| Mobile Community Health Clinic | 08:30 AM | 04:30 PM | `CLIN-CARE` | 1 Nurse Lead (`EMP-2009`), 1 Case Worker (`EMP-2010`), 1 Health Navigator (`VOL-3008`) |
| `SHF-EVN-SHEL`| Night Shelter Reception & Safety | 08:00 PM | 04:00 AM | `HUM-OPS` | 1 Security/Operations Officer, 2 Stewards (`VOL-3006`) |
| `SHF-GNT-WRK` | Grant Proposal Workblock | 09:00 AM | 05:00 PM | `DEV-GRANT` | 1 Lead Writer (`EMP-2001`), 1 Coordinator (`EMP-2002`) |

---

## 5. Seed Database Export (JSON Schema Format)

You can directly ingest this JSON payload into your backend database (PostgreSQL / Supabase / Firebase / MongoDB):

```json
{
  "organization": {
    "name": "Beacon Hope Community & Relief International",
    "ein": "84-9281729",
    "timezone": "America/Denver",
    "address": "450 Relief Parkway, Suite 300, Denver, CO 80202"
  },
  "departments": [
    {"code": "EXEC", "name": "Executive Leadership", "budget_code": "DEPT-001"},
    {"code": "PROG-CD", "name": "Child Development & Youth Services", "budget_code": "DEPT-002"},
    {"code": "HUM-OPS", "name": "Humanitarian Aid & Emergency Relief", "budget_code": "DEPT-003"},
    {"code": "DEV-GRANT", "name": "Development & Grant Management", "budget_code": "DEPT-004"},
    {"code": "COMM-VOL", "name": "Volunteer & Community Engagement", "budget_code": "DEPT-005"},
    {"code": "CLIN-CARE", "name": "Community Health & Psycho-Social Support", "budget_code": "DEPT-006"},
    {"code": "FIN-ADMIN", "name": "Finance, HR & Administrative Ops", "budget_code": "DEPT-007"}
  ],
  "users": [
    {
      "id": "EMP-1004",
      "first_name": "Camila",
      "last_name": "O'Connor",
      "email": "c.oconnor@beaconhope.org",
      "role": "Director of Youth & Family Programs",
      "dept_code": "PROG-CD",
      "is_exempt": true,
      "employment_status": "Full-Time",
      "annual_salary": 98000,
      "hourly_rate": null,
      "weekly_target_hours": 40,
      "certifications": ["MSW", "LCSW", "Early Childhood Licensure"],
      "skills": ["Child Trauma Assessment", "Program Design", "Staff Supervision"],
      "default_availability": {"mon": ["08:00-16:30"], "tue": ["08:00-16:30"], "wed": ["08:00-16:30"], "thu": ["08:00-16:30"], "fri": ["08:00-16:30"]}
    },
    {
      "id": "EMP-2001",
      "first_name": "Siddharth",
      "last_name": "Mehta",
      "email": "s.mehta@beaconhope.org",
      "role": "Senior Grant Writing Specialist",
      "dept_code": "DEV-GRANT",
      "is_exempt": true,
      "employment_status": "Full-Time",
      "annual_salary": 78000,
      "hourly_rate": null,
      "weekly_target_hours": 40,
      "certifications": ["CFRE Candidate", "Federal Grants Certified"],
      "skills": ["Federal NOFO Applications", "Impact Measurement", "Budget Justifications"],
      "default_availability": {"mon": ["08:30-17:00"], "tue": ["08:30-17:00"], "wed": ["08:30-17:00"], "thu": ["08:30-17:00"], "fri": ["08:30-17:00"]}
    },
    {
      "id": "EMP-2003",
      "first_name": "Nia",
      "last_name": "Kimani",
      "email": "n.kimani@beaconhope.org",
      "role": "Lead Child Development Specialist",
      "dept_code": "PROG-CD",
      "is_exempt": true,
      "employment_status": "Full-Time",
      "annual_salary": 66000,
      "hourly_rate": null,
      "weekly_target_hours": 40,
      "certifications": ["Pediatric CPR", "Infant Mental Health Specialist"],
      "skills": ["Early Intervention", "Play Therapy", "Parent Coaching"],
      "default_availability": {"mon": ["07:30-16:00"], "tue": ["07:30-16:00"], "wed": ["07:30-16:00"], "thu": ["07:30-16:00"], "fri": ["07:30-16:00"]}
    },
    {
      "id": "EMP-2008",
      "first_name": "David",
      "last_name": "O'Reilly",
      "email": "d.oreilly@beaconhope.org",
      "role": "Warehouse & Distribution Lead",
      "dept_code": "HUM-OPS",
      "is_exempt": false,
      "employment_status": "Full-Time",
      "annual_salary": null,
      "hourly_rate": 24.50,
      "weekly_target_hours": 40,
      "certifications": ["Forklift Class I-V", "OSHA-30"],
      "skills": ["Inventory Management", "Relief Logistics", "Cold Chain Storage"],
      "default_availability": {"mon": ["07:00-15:30"], "tue": ["07:00-15:30"], "wed": ["07:00-15:30"], "thu": ["07:00-15:30"], "fri": ["07:00-15:30"]}
    },
    {
      "id": "VOL-3002",
      "first_name": "Devon",
      "last_name": "Miller",
      "email": "devon.m.volunteer@gmail.com",
      "role": "Youth Activities Assistant",
      "dept_code": "PROG-CD",
      "is_exempt": false,
      "employment_status": "Volunteer",
      "annual_salary": null,
      "hourly_rate": 0.00,
      "weekly_target_hours": 12,
      "certifications": ["Pediatric CPR", "DOJ/FBI Background Clear"],
      "skills": ["STEM Tutoring", "Arts & Crafts", "Group Supervision"],
      "default_availability": {"mon": ["15:00-18:30"], "wed": ["15:00-18:30"], "fri": ["15:00-18:30"]}
    },
    {
      "id": "VOL-3003",
      "first_name": "Soraya",
      "last_name": "Haddad",
      "email": "soraya.haddad@volunteer.beaconhope.org",
      "role": "Translation & Intake Volunteer",
      "dept_code": "HUM-OPS",
      "is_exempt": false,
      "employment_status": "Volunteer",
      "annual_salary": null,
      "hourly_rate": 0.00,
      "weekly_target_hours": 12,
      "certifications": ["HIPAA Compliance", "Certified Medical Interpreter"],
      "skills": ["Arabic Fluency", "French Fluency", "Crisis Triage"],
      "default_availability": {"tue": ["09:00-15:00"], "thu": ["09:00-15:00"]}
    }
  ]
}
```

---

## 6. Compensation Summary & Staffing Rules for Scheduling Engine

1. **Overtime & Fair Labor Standards Act (FLSA) Rules:**
   - **Exempt Staff (Salaried):** No overtime calculations. Assigned standard 40h work patterns.
   - **Non-Exempt Staff (Hourly):** Shifts exceeding 8 hours/day or 40 hours/week trigger overtime multiplier `1.5x`.
   - **Volunteers:** Strict cap enforced per volunteer agreement (typically max 15–20 hours/week) to avoid employment classification issues.

2. **Mandatory Ratio Constraints for Scheduling Engine:**
   - **Child Development / Youth Programs:** 1 Adult per 6 Children under age 5; 1 Adult per 10 Children ages 6–12.
   - **Volunteer Supervision:** At least 1 Full-Time Employee (Supervisor or Coordinator) must be present for every group of up to 6 active volunteers.
   - **Emergency Aid Dispatch:** Requires a certified Dispatch Lead (`EMP-2007` or `EMP-2006`) at all operational hours.