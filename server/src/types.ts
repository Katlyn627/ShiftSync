export interface Site {
  id: number;
  name: string;
  city: string;
  state: string;
  timezone: string;
  site_type: 'restaurant' | 'hotel';
  /** Jurisdiction code used to select applicable compliance rules, e.g. 'default', 'eu', 'us-ca' */
  jurisdiction: string;
  created_at: string;
}

export interface Employee {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  role: string;
  role_title: string;
  department: string;
  /** 'hourly' or 'salaried' — drives overtime eligibility */
  pay_type: 'hourly' | 'salaried';
  hourly_rate: number;
  weekly_hours_max: number;
  /** JSON-encoded array of skill/certification labels, e.g. ["food-handler","barista"] */
  certifications: string;
  /** True if the worker is a minor (triggers eligibility constraints) */
  is_minor: number; // 0 | 1
  /** True if the worker is covered by a union agreement */
  union_member: number; // 0 | 1
  email: string;
  phone: string;
  photo_url: string | null;
  hire_date: string;
  site_id: number | null;
  created_at: string;
}

/**
 * A single compliance rule entry for a jurisdiction.
 * rule_type values include: min_rest_hours, max_consecutive_days, max_weekly_hours,
 * overtime_threshold_daily, advance_notice_days, predictability_pay_hours,
 * minor_max_daily_hours, minor_max_weekly_hours.
 */
export interface ComplianceRule {
  id: number;
  jurisdiction: string;
  rule_type: string;
  /** Numeric or string value, stored as text */
  rule_value: string;
  description: string;
  enabled: number; // 0 | 1
  created_at: string;
}

/**
 * Immutable audit log entry recording compliance-relevant actions.
 */
export interface AuditLog {
  id: number;
  action: string;           // e.g. 'shift_assigned', 'swap_approved', 'time_off_rejected', 'schedule_published'
  entity_type: string;      // 'shift' | 'swap' | 'time_off' | 'schedule' | 'employee'
  entity_id: number | null;
  user_id: number | null;   // user who performed the action
  details: string;          // JSON-encoded supplementary data
  created_at: string;
}

/**
 * An appeal submitted by an employee contesting an automated scheduling decision.
 */
export interface SchedulingAppeal {
  id: number;
  shift_id: number | null;
  employee_id: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  manager_notes: string | null;
  created_at: string;
}

export interface Availability {
  id: number;
  employee_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Forecast {
  id: number;
  date: string;
  expected_revenue: number;
  expected_covers: number;
}

export interface Schedule {
  id: number;
  week_start: string;
  labor_budget: number;
  status: string;
  site_id: number | null;
  created_at: string;
}

export interface WeeklyOvertime {
  id: number;
  employee_id: number;
  week_start: string;
  regular_hours: number;
  overtime_hours: number;
  overtime_pay: number;
  created_at: string;
}

export interface Shift {
  id: number;
  schedule_id: number;
  employee_id: number;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  status: string;
  created_at: string;
}

export interface ShiftSwap {
  id: number;
  shift_id: number;
  requester_id: number;
  target_id: number | null;
  reason: string | null;
  status: string;
  manager_notes: string | null;
  created_at: string;
}

export interface BurnoutRisk {
  employee_id: number;
  employee_name: string;
  risk_level: 'low' | 'medium' | 'high';
  risk_score: number;
  factors: string[];
  weekly_hours: number;
  consecutive_days: number;
  clopens: number;
  doubles: number;
  late_night_shifts: number;
  rest_days_recommended: number;
}

export interface StaffingNeed {
  role: string;
  start: string;
  end: string;
  count: number;
}

export interface DailyStaffingSuggestion {
  date: string;
  day_of_week: number;
  expected_revenue: number;
  expected_covers: number;
  staffing: StaffingNeed[];
}

export interface LaborCostSummary {
  schedule_id: number;
  week_start: string;
  labor_budget: number;
  projected_cost: number;
  actual_cost: number;
  variance: number;
  by_day: { date: string; cost: number }[];
  by_role: { role: string; cost: number }[];
}

export interface RestaurantSettings {
  seats: number;
  tables: number;
  cogs_pct: number;           // Food/beverage cost as % of revenue (e.g. 30)
  target_labor_pct: number;   // Target labor cost % of revenue (e.g. 30)
  operating_hours_per_day: number; // Average hours open per day
}

export interface DaypartRevenue {
  daypart: string;   // e.g. 'Breakfast', 'Lunch', 'Dinner', 'Late Night'
  start: string;     // HH:MM
  end: string;       // HH:MM
  revenue_pct: number; // estimated % of weekly revenue
  revenue: number;     // estimated dollar revenue for this daypart (weekly)
  labor_cost: number;
  covers: number;
}

export interface DayRevenue {
  date: string;          // YYYY-MM-DD
  day_name: string;      // 'Mon', 'Tue', etc.
  expected_revenue: number;
  expected_covers: number;
  labor_cost: number;
  revenue_pct: number;   // this day's share of total weekly revenue (0–1)
}

export interface ProfitabilityMetrics {
  schedule_id: number;
  week_start: string;
  // Business type (drives daypart labels & terminology)
  site_type: 'restaurant' | 'hotel';
  // Prime Cost
  prime_cost: number;
  prime_cost_pct: number;         // (labor + COGS) / revenue × 100
  prime_cost_target_pct: number;  // target ≤ 65
  prime_cost_status: 'good' | 'warning' | 'over';
  // Labor Cost
  total_labor_cost: number;
  labor_cost_pct: number;         // labor / revenue × 100
  labor_cost_target_pct: number;
  // Revenue
  total_expected_revenue: number;
  total_expected_covers: number;
  // COGS
  estimated_cogs: number;
  cogs_pct: number;
  // RevPASH
  revpash: number;                // revenue / (seats × operating_hours)
  // Table Turnover Rate
  table_turnover_rate: number;    // covers / tables per service period
  // Average Check per Head
  avg_check_per_head: number;     // revenue / covers
  // Sales by Day (actual per-day data from forecasts)
  sales_by_day: DayRevenue[];
  // Sales by Daypart (time-of-day distribution, tailored to site_type)
  sales_by_daypart: DaypartRevenue[];
  // Employee Turnover Risk
  high_turnover_risk_count: number;
  turnover_risk_pct: number;       // high-risk employees / total scheduled
}

export interface StandbyAssignment {
  id: number;
  schedule_id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  role: string;
  created_at: string;
}

export interface DailyCoverageReport {
  date: string;
  day_of_week: number;
  expected_revenue: number;
  scheduled_count: number;
  standby_count: number;
  standbys: StandbyAssignment[];
  coverage_status: 'good' | 'at_risk' | 'critical';
}

export interface ScheduleCoverageReport {
  schedule_id: number;
  week_start: string;
  days: DailyCoverageReport[];
  total_standby_count: number;
  days_at_risk: number;
}