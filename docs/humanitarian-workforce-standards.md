# Humanitarian Workforce Standards & Non-Profit Scheduling Architecture

## 📖 Overview & Purpose
This guide establishes operational standards, financial budgeting frameworks (2 CFR 200 / Uniform Guidance, NICRA, MTDC), psychological safety & burnout risk analytics (CBI, ProQOL-5, BAT), and duty-of-care scheduling models for humanitarian relief organizations, non-profit community health providers, and social impact enterprises using **ShiftSync**.

---

## 🏛️ 1. Non-Profit Budgeting & Financial Compliance (2 CFR 200 / NICRA)

Humanitarian organizations funded through federal grants (e.g., USAID, FEMA, HHS, State Dept) and multilateral donors (UNHCR, UNICEF, Global Fund) must operate under strict cost-allocation principles governed by **2 CFR 200 (Uniform Guidance)**.

```
Total Operating Budget ($1,274,000 Annual / $24,500 Weekly)
 ├── Direct Program Operations (80.5%) ── $19,722 / week
 │    ├── Humanitarian Aid & Rapid Relief Staff
 │    ├── Child Development & Youth Empowerment Specialists
 │    └── Community Health & Psycho-Social Case Workers
 ├── Management & General / Indirect (14.2%) ── $3,478 / week
 │    ├── Executive Leadership & Governance
 │    └── Finance, HR & Administrative Compliance
 └── Development & Grant Management (5.3%) ── $1,300 / week
      └── Monitoring & Evaluation (M&E) & Grant Reporting
```

### 1.1 Program Expense Ratio (The 75/15/10 Rule)
* **Program Services**: **75% – 85%** of total expenses must directly serve program beneficiaries.
* **Management & General (M&G)**: **10% – 15%** for core executive leadership, governance, IT, and legal compliance.
* **Fundraising / Development**: **5% – 10%** for donor relations, grant application drafting, and monitoring.

### 1.2 Direct vs. Indirect Costs & NICRA
* **Modified Total Direct Costs (MTDC)**: All direct salaries, wages, applicable fringe benefits, materials, supplies, services, travel, and subawards up to \$25,000.
* **Negotiated Indirect Cost Rate Agreement (NICRA)**: Standard rate negotiated with the cognizant federal agency (or standard **15% de minimis rate** under 2 CFR 200.414).
* **Fringe Benefits Factor**: Standard **22% – 28% (24% baseline)** applied across paid staff for payroll taxes (FICA/Medicare), health insurance, workers' comp, disability, and retirement contributions.

### 1.3 In-Kind Volunteer Valuation (Independent Sector Benchmark)
* Under Federal Uniform Guidance and GAAP, volunteer contributions may be counted toward mandatory grant matching and non-federal cost sharing.
* **Independent Sector National Volunteer Hourly Rate**: **\$33.49 / hour** (2025/2026 benchmark).
* In a typical weekly humanitarian relief deployment with 5 community volunteers working 12 hours each (60 hours total), the in-kind match value is:
  $$\text{In-Kind Value} = 60\text{ hours} \times \$33.49 = \$2,009.40\text{ / week}$$

---

## 👥 2. Humanitarian Staffing & Compensation Matrix

| Department | Role Title | Standard Qualifications | Hourly Rate | Weekly Hours Max | Annual Equivalent |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Executive Leadership** | Chief Executive Officer | `FEMA_ICS_400`, `NGO_Governance` | \$38.00 – \$43.00 | 45 hrs | \$79k – \$90k |
| **Humanitarian Aid & Relief** | International Program Manager | `FEMA_ICS_400`, `START_Triage`, `HazMat` | \$34.00 – \$38.00 | 45 hrs | \$70k – \$79k |
| **Child Development** | Program Officer (Lead) | `CPR_AED_Pediatric`, `Trauma_Informed_Care` | \$30.00 – \$34.00 | 44 hrs | \$62k – \$70k |
| **Development & Grants** | Monitoring & Evaluation (M&E) | `Grant_Compliance_Audit`, `Data_Governance` | \$25.00 – \$31.00 | 42 hrs | \$52k – \$64k |
| **Community Health** | Safeguarding Officer | `MSW_LCSW`, `Child_Protection_Advanced` | \$24.00 – \$29.00 | 40 hrs | \$50k – \$60k |
| **Finance & HR** | Finance and HR Coordinator | `SHRM_CP`, `Nonprofit_Accounting` | \$24.00 – \$29.00 | 40 hrs | \$50k – \$60k |
| **Youth Services** | Child Development Specialist | `CPR_AED_Pediatric`, `Early_Childhood` | \$23.00 – \$28.00 | 42 hrs | \$48k – \$58k |
| **Community Health** | Community Health Case Worker | `MSW_LCSW`, `Mental_Health_First_Aid` | \$23.00 – \$27.00 | 40 hrs | \$48k – \$56k |
| **Field Relief** | Field Coordinator | `FEMA_ICS_400`, `START_Triage`, `Field_Security` | \$22.00 – \$26.00 | 42 hrs | \$46k – \$54k |
| **Logistics** | Logistics & Grants Coordinator | `HazMat_Handler`, `Grant_Management_Pro` | \$21.00 – \$25.00 | 40 hrs | \$44k – \$52k |
| **Volunteer Ops** | Volunteer Coordinator | `Volunteer_Supervision`, `Mental_Health_First_Aid` | \$20.00 – \$24.00 | 40 hrs | \$42k – \$50k |
| **Community Engagement** | Volunteer | `Basic_First_Aid`, `Youth_Safety` | \$0.00 (In-kind) | **16 hrs (Cap)** | \$0.00 |

---

## ⏰ 3. Duty-of-Care Scheduling Models (CHS Alliance Commitment 8)

The **Core Humanitarian Standard (CHS) Commitment 8** mandates that organizations have a proactive duty of care to protect the physical, psychological, and mental health of all staff and volunteers.

### 3.1 Standard Shift Archetypes

| Shift Archetype | Operating Window | Duration | Primary Roles | Rest & Decompression Requirements |
| :--- | :--- | :--- | :--- | :--- |
| **Emergency Field Response** | `07:30 – 15:30` | 8.0 hrs | Field Coordinator, Triage Lead | Min 11h turnaround; Max 5 consecutive days |
| **Youth Center Morning** | `08:00 – 16:00` | 8.0 hrs | Child Development Specialist | Min 12h turnaround; 2 mandatory rest days/week |
| **Community Outreach** | `08:30 – 16:30` | 8.0 hrs | Case Worker, Program Officer | Case load ratio $< 25:1$ active clients |
| **Youth Center Afternoon** | `11:00 – 19:00` | 8.0 hrs | Child Dev, Community Health | 1-hour midday resilience/peer check-in |
| **Volunteer Morning Wave** | `09:00 – 13:00` | 4.0 hrs | Community Volunteer | Max 16h/week; Non-consecutive preferred |
| **Volunteer Afternoon Wave**| `13:00 – 17:00` | 4.0 hrs | Community Volunteer | Max 16h/week; Mandatory safety briefing |
| **Overnight Crisis Dispatch**| `23:00 – 07:30` | 8.5 hrs | Mobile Crisis Clinician | Min 16h rest turnaround; Max 3 consecutive nights |

### 3.2 Key Scheduling Constraints & Alerts
1. **Turnaround Rest Window ("Clopen" Protection)**: Minimum **11 hours** (ideally 12 hours) between consecutive shifts. Violations trigger amber/red alerts in the scheduling interface.
2. **Consecutive Days Limit**:
   - Standard Non-Profit Staff: Maximum **6 consecutive days**.
   - High-Intensity Field / Emergency Relief: Maximum **5 consecutive days**, requiring a mandatory 48-hour decompression break.
3. **Volunteer Hour Safeguard**: Hard limit of **16 hours / week** per volunteer to prevent volunteer fatigue and FLSA non-exempt worker misclassification.
4. **Advance Notice SLA**: Schedules must be published at least **14 days in advance** to support family predictability and psychological stability.

---

## 🧠 4. Validated Burnout & Psychological Fatigue Battery

### 4.1 Copenhagen Burnout Inventory (CBI)
Measures fatigue and exhaustion across three distinct subscales (scored 0–100%):
* **Personal Burnout**: Physical and psychological exhaustion experienced regardless of occupational role.
* **Work-Related Burnout**: Chronic exhaustion attributed specifically to workplace conditions, caseload, and shift intensity.
* **Client-Related Burnout**: Compassion fatigue and emotional depletion stemming directly from working with vulnerable populations.

### 4.2 Professional Quality of Life (ProQOL-5)
The gold standard self-assessment instrument for healthcare and humanitarian workers:

| Subscale | Low Risk | Moderate | High Risk (Action Required) | Primary Mitigations |
| :--- | :--- | :--- | :--- | :--- |
| **Compassion Satisfaction** | $\le 22$ (Concern) | $23 - 41$ | $\ge 42$ (Optimal) | Peer recognition, mission debriefs |
| **Burnout (ProQOL)** | $\le 22$ (Optimal) | $23 - 41$ | $\ge 42$ (Severe) | Mandatory rest rotation, reduce weekly hours |
| **Secondary Traumatic Stress**| $\le 22$ (Optimal) | $23 - 41$ | $\ge 42$ (Critical) | Clinical supervision, shift rotation off frontline |

### 4.3 ShiftSync Automated Fatigue Penalty Algorithm
ShiftSync continuously evaluates active schedules to produce an empirical **0–100 Burnout Risk Score**:
$$\text{Risk Score} = \text{Overtime Score} + \text{Turnaround Penalty} + \text{Consecutive Days Penalty} + \text{Late Night Factor} + \text{Field Intensity}$$
* **Low Risk ($0 - 29$)**: Normal operational monitoring.
* **Medium Risk ($30 - 59$)**: Manager warning banner; 1 rest day recommended.
* **High Risk ($60 - 100$)**: Critical alert; 2 rest days recommended; automatic eligibility block for additional open shift claims.

---

## 🔒 5. Privacy & Statistical Suppression ($k$-Anonymity)
To ensure psychological safety and encourage honest survey participation:
* **$k$-Anonymity Threshold ($k = 5$)**: Survey results are strictly suppressed unless at least 5 team members have responded within a specific department or role group.
* **Aggregated Subscale Distribution**: Individual response values are never accessible to supervisors or administrators; only group averages and subscale risk tiers are calculated.
