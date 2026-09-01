export interface Site {
  id: number;
  name: string;
  city: string;
  state: string;
  timezone: string;
  site_type: 'restaurant' | 'hotel' | 'retail' | 'healthcare' | 'fitness' | 'salon_spa' | 'warehouse' | 'education' | 'childcare' | 'security' | 'office' | 'other';
  /** Jurisdiction code used to select applicable compliance rules, e.g. 'default', 'eu', 'us-ca' */
  jurisdiction: string;
  address: string;
  business_hours: string;
  employee_capacity: number;
  foh_roles: string;
  boh_roles: string;
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
  /** Latitude from browser geolocation, null when not set */
  location_lat: number | null;
  /** Longitude from browser geolocation, null when not set */
  location_lng: number | null;
  /** Human-readable location label (reverse-geocoded address or custom text) */
  location_label: string | null;
  /** 1 if volunteer, 0 otherwise */
  is_volunteer?: number;
  /** Max weekly hours cap for volunteers */
  volunteer_max_hours?: number;
  /** Emergency contact info */
  emergency_contact?: string;
  /** JSON-encoded array of skills */
  skills?: string;
  /** Background check clearance status */
  background_check_status?: string;
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
  staffing_status?: 'adequate' | 'understaffed' | 'overstaffed';
  staffing_delta?: number;
  staffing_actual?: number;
  staffing_suggested?: number;
  role_deltas?: Array<{ role: string; delta: number; suggested: number; actual: number }>;
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
  program_direct_cost?: number;
  admin_indirect_cost?: number;
  program_expense_ratio?: number;
  fringe_benefits_cost?: number;
  volunteer_in_kind_hours?: number;
  volunteer_in_kind_value?: number;
  total_labor_hours?: number;
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
  site_type: 'restaurant' | 'hotel' | 'retail' | 'healthcare' | 'fitness' | 'salon_spa' | 'warehouse' | 'education' | 'childcare' | 'security' | 'office' | 'other';
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
  // POS data source (populated when a POS integration has been synced for this site)
  pos_last_synced: { platform: string; display_name: string; at: string } | null;
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

export interface SurveyTemplate {
  id: number;
  instrument: string;
  name: string;
  description: string;
  questions: string; // JSON array of SurveyQuestion
  active: number;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  scale: number;
  subscale: string;
  reversed?: boolean;
  role_specific?: boolean;
}

export interface SurveyCampaign {
  id: number;
  template_id: number;
  site_id: number | null;
  title: string;
  instrument?: string;
  template_name?: string;
  description?: string;
  questions?: string;
  start_date: string;
  end_date: string;
  anonymized: number;
  min_group_size: number;
  status: 'active' | 'closed' | 'draft';
  response_count?: number;
  already_responded?: boolean;
  responded_at?: string | null;
  recurrence: 'none' | 'weekly';
  schedule_day_of_week?: number | null;
  next_send_date?: string | null;
  target_roles?: string;
  parent_campaign_id?: number | null;
  created_at: string;
}

export interface SurveySubscaleResult {
  subscale: string;
  avg_score: number | null;
  item_count: number;
  interpretation: string;
  pct_high: number;
}

export interface SurveyBreakdownSegment {
  segment: string;
  response_count: number;
  subscale_results: SurveySubscaleResult[];
}

export interface SurveyResults {
  campaign_id: number;
  instrument?: string;
  response_count: number;
  min_group_size: number;
  results_available: boolean;
  message?: string;
  subscale_results?: SurveySubscaleResult[];
  department_breakdowns?: SurveyBreakdownSegment[];
  role_title_breakdowns?: SurveyBreakdownSegment[];
  purpose_limitation: string;
  data_governance?: string;
}

export interface SurveyRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  action: string;
}

export interface SurveyRecommendations {
  campaign_id: number;
  results_available: boolean;
  recommendations: SurveyRecommendation[];
  message?: string;
  purpose_limitation?: string;
}

export interface FairnessEmployee {
  employee_id: number;
  employee_name: string;
  role: string;
  department?: string;
  total_shifts: number;
  total_hours: number;
  night_shifts: number;
  weekend_shifts: number;
  overtime_hours: number;
  fairness_flags: string[];
}

export interface RoleFairnessStats {
  role: string;
  employee_count: number;
  avg_hours: number;
  avg_night_shifts: number;
  avg_weekend_shifts: number;
  hours_std_dev: number;
  fairness_score: 'equitable' | 'moderate' | 'inequitable';
}

export interface FairnessReport {
  employees: FairnessEmployee[];
  role_stats: RoleFairnessStats[];
  summary: { total_employees: number; total_shifts: number; employees_with_flags: number } | null;
}

export interface InstabilityReport {
  schedule_id: number;
  week_start: string;
  site_id?: number | null;
  status?: string;
  total_shifts: number;
  active_shifts: number;
  cancelled_shifts: number;
  cancellation_rate_pct: number;
  change_requests: number;
  late_change_count: number;
  quick_returns: number;
  callout_count: number;
  days_advance_published: number;
  required_advance_days: number;
  predictability_pay_exposure_count: number;
  instability_score: number;
  instability_level: 'stable' | 'moderate' | 'volatile';
}

export interface ChangeRequest {
  id: number;
  shift_id: number;
  requested_by: number;
  change_type: string;
  reason_code: string;
  reason_detail: string | null;
  original_date: string | null;
  original_start_time: string | null;
  original_end_time: string | null;
  new_date: string | null;
  new_start_time: string | null;
  new_end_time: string | null;
  worker_consent: 'pending' | 'accepted' | 'rejected' | 'not_required';
  status: 'pending' | 'approved' | 'rejected';
  manager_notes: string | null;
  employee_name?: string;
  employee_role?: string;
  shift_date?: string;
  shift_start?: string;
  shift_end?: string;
  created_at: string;
}

export interface PublishSla {
  id: number;
  site_id: number;
  role: string | null;
  advance_days: number;
  created_at: string;
}

export interface CalloutEvent {
  id: number;
  shift_id: number | null;
  employee_id: number;
  employee_name?: string;
  employee_role?: string;
  replacement_name?: string;
  shift_date?: string;
  start_time?: string;
  end_time?: string;
  shift_role?: string;
  callout_time: string;
  reason: string | null;
  replacement_employee_id: number | null;
  replacement_status: 'none' | 'searching' | 'found' | 'not_found';
  open_shift_id: number | null;
  manager_override: number;
  manager_notes: string | null;
  created_at: string;
}

