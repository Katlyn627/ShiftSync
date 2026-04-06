const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('shiftsync_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Auth
export const registerEmployee = (data: { employeeName: string; username: string; password: string }) =>
  request<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify(data) });

export const registerManager = (data: {
  businessName: string;
  city: string;
  state: string;
  timezone: string;
  industry: string;
  managerName: string;
  username: string;
  password: string;
  positions?: string[];
}) =>
  request<{ token: string; user: any; positions: string[] }>('/auth/register-manager', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Employees
export const getEmployees = () => request<Employee[]>('/employees');
export const createEmployee = (data: Omit<Employee, 'id' | 'created_at'>) =>
  request<Employee>('/employees', { method: 'POST', body: JSON.stringify(data) });
export const updateEmployee = (id: number, data: Partial<Employee>) =>
  request<Employee>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteEmployee = (id: number) =>
  request<{ success: boolean }>(`/employees/${id}`, { method: 'DELETE' });

export const getAvailability = (empId: number) =>
  request<Availability[]>(`/employees/${empId}/availability`);
export const setAvailability = (empId: number, data: { day_of_week: number; availability_type: string; start_time?: string; end_time?: string }) =>
  request<Availability>(`/employees/${empId}/availability`, { method: 'POST', body: JSON.stringify(data) });
export const deleteAvailability = (empId: number, dayOfWeek: number) =>
  request<{ success: boolean }>(`/employees/${empId}/availability/${dayOfWeek}`, { method: 'DELETE' });

// Schedules
export const getSchedules = () => request<Schedule[]>('/schedules');
export const generateSchedule = (week_start: string, labor_budget: number) =>
  request<Schedule>('/schedules/generate', { method: 'POST', body: JSON.stringify({ week_start, labor_budget }) });
export const getScheduleShifts = (id: number) => request<ShiftWithEmployee[]>(`/schedules/${id}/shifts`);
export const getLaborCost = (id: number) => request<LaborCostSummary>(`/schedules/${id}/labor-cost`);
export const getBurnoutRisks = async (id: number): Promise<BurnoutRisk[]> => {
  const data = await request<BurnoutRisk[] | { own: BurnoutRisk | null; summary: unknown }>(`/schedules/${id}/burnout-risks`);
  if (Array.isArray(data)) return data;
  return data.own ? [data.own] : [];
};
export const updateSchedule = (id: number, data: { status: string }) =>
  request<Schedule>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSchedule = (id: number) =>
  request<{ success: boolean }>(`/schedules/${id}`, { method: 'DELETE' });

// Shifts
export const updateShift = (id: number, data: Partial<Shift> & { employee_id?: number }) =>
  request<ShiftWithEmployee>(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const createShift = (data: { schedule_id: number; employee_id?: number; date: string; start_time: string; end_time: string; role: string }) =>
  request<ShiftWithEmployee>('/shifts', { method: 'POST', body: JSON.stringify(data) });
export const deleteShift = (id: number) =>
  request<{ success: boolean }>(`/shifts/${id}`, { method: 'DELETE' });
export const dropShift = (id: number, reason: string) =>
  request<{ swap: ShiftSwap; is_last_minute: boolean; hours_until_shift: number }>(`/shifts/${id}/drop`, { method: 'POST', body: JSON.stringify({ reason }) });

// Swaps
export const getSwaps = () => request<SwapWithDetails[]>('/swaps');
export const createSwap = (data: { shift_id: number; requester_id: number; target_id?: number; reason?: string }) =>
  request<ShiftSwap>('/swaps', { method: 'POST', body: JSON.stringify(data) });
export const approveSwap = (id: number, manager_notes?: string) =>
  request<ShiftSwap>(`/swaps/${id}/approve`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });
export const rejectSwap = (id: number, manager_notes?: string) =>
  request<ShiftSwap>(`/swaps/${id}/reject`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });

// Forecasts
export const getForecasts = () => request<Forecast[]>('/forecasts');
export const upsertForecast = (data: Omit<Forecast, 'id'>) =>
  request<Forecast>('/forecasts', { method: 'POST', body: JSON.stringify(data) });
export const getStaffingSuggestions = (week_start: string) =>
  request<DailyStaffingSuggestion[]>(`/schedules/staffing-suggestions?week_start=${week_start}`);
export const getGeneratePreview = (week_start: string) =>
  request<GeneratePreview>(`/schedules/generate-preview?week_start=${week_start}`);

// Time-off requests
export const getTimeOffRequests = () => request<TimeOffRequest[]>('/time-off');
export const createTimeOffRequest = (data: { start_date: string; end_date: string; reason?: string }) =>
  request<TimeOffRequest>('/time-off', { method: 'POST', body: JSON.stringify(data) });
export const approveTimeOffRequest = (id: number, manager_notes?: string) =>
  request<TimeOffRequest>(`/time-off/${id}/approve`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });
export const rejectTimeOffRequest = (id: number, manager_notes?: string) =>
  request<TimeOffRequest>(`/time-off/${id}/reject`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });
export const cancelTimeOffRequest = (id: number) =>
  request<{ success: boolean }>(`/time-off/${id}`, { method: 'DELETE' });

// Settings
export const getRestaurantSettings = () => request<RestaurantSettings>('/settings');
export const updateRestaurantSettings = (data: Partial<RestaurantSettings>) =>
  request<RestaurantSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) });

// Sites
export const getSites = () => request<Site[]>('/sites');
export const getSiteEmployees = (siteId: number) => request<Employee[]>(`/sites/${siteId}/employees`);

// Overtime
export const getOvertime = () => request<WeeklyOvertime[]>('/overtime');
export const getEmployeeOvertime = (empId: number) => request<WeeklyOvertime[]>(`/overtime/employee/${empId}`);

// Profitability Metrics
export const getProfitabilityMetrics = (scheduleId: number) =>
  request<ProfitabilityMetrics>(`/schedules/${scheduleId}/profitability-metrics`);

// Coverage / Standby
export const getScheduleCoverage = (scheduleId: number) =>
  request<ScheduleCoverageReport>(`/schedules/${scheduleId}/coverage`);

// Schedule Intelligence (manager-only)
export const getScheduleIntelligence = (scheduleId: number) =>
  request<ScheduleIntelligence>(`/schedules/${scheduleId}/intelligence`);

// POS Integrations
export const getPosIntegrations = () => request<PosIntegration[]>('/pos-integrations');
export const createPosIntegration = (data: { platform_name: string; display_name?: string; api_key?: string }) =>
  request<PosIntegration>('/pos-integrations', { method: 'POST', body: JSON.stringify(data) });
export const deletePosIntegration = (id: number) =>
  request<{ success: boolean }>(`/pos-integrations/${id}`, { method: 'DELETE' });
export const syncPosIntegration = (id: number) =>
  request<PosIntegrationSyncResult>(`/pos-integrations/${id}/sync`, { method: 'POST' });

// Positions
export const getPositions = () => request<Position[]>('/positions');
export const createPosition = (name: string) =>
  request<Position>('/positions', { method: 'POST', body: JSON.stringify({ name }) });
export const updatePosition = (id: number, data: { name?: string; is_active?: boolean }) =>
  request<Position>(`/positions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePosition = (id: number) =>
  request<{ success: boolean }>(`/positions/${id}`, { method: 'DELETE' });

// Types
export type SiteType =
  | 'restaurant' | 'hotel' | 'retail' | 'healthcare' | 'fitness'
  | 'salon_spa' | 'warehouse' | 'education' | 'childcare' | 'security' | 'office' | 'other';

export interface Position {
  id: number;
  site_id: number;
  name: string;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface Site {
  id: number;
  name: string;
  city: string;
  state: string;
  timezone: string;
  site_type: SiteType;
  created_at: string;
}

export interface Employee {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  role: string;
  role_title?: string;
  department?: string;
  hourly_rate: number;
  weekly_hours_max: number;
  email?: string;
  phone?: string;
  photo_url?: string | null;
  hire_date?: string;
  site_id?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_label?: string | null;
  created_at: string;
}

export interface Availability {
  id: number;
  employee_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  availability_type: 'specific' | 'open' | 'unavailable';
}

export interface Schedule {
  id: number;
  week_start: string;
  labor_budget: number;
  status: string;
  site_id?: number | null;
  created_at: string;
}

export interface WeeklyOvertime {
  id: number;
  employee_id: number;
  employee_name: string;
  role: string;
  site_id?: number | null;
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
}

export interface ShiftWithEmployee extends Shift {
  employee_name: string;
  employee_role: string;
  hourly_rate: number;
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

export interface SwapWithDetails extends ShiftSwap {
  requester_name: string;
  target_name: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_role: string;
}

export interface Forecast {
  id: number;
  date: string;
  expected_revenue: number;
  expected_covers: number;
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

export interface TimeOffRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  manager_notes: string | null;
  created_at: string;
}

export interface RestaurantSettings {
  seats: number;
  tables: number;
  cogs_pct: number;
  target_labor_pct: number;
  operating_hours_per_day: number;
}

export interface DaypartRevenue {
  daypart: string;
  start: string;
  end: string;
  revenue_pct: number;
  revenue: number;
  labor_cost: number;
  covers: number;
}

export interface DayRevenue {
  date: string;
  day_name: string;
  expected_revenue: number;
  expected_covers: number;
  labor_cost: number;
  revenue_pct: number;
}

export interface ProfitabilityMetrics {
  schedule_id: number;
  week_start: string;
  site_type: SiteType;
  prime_cost: number;
  prime_cost_pct: number;
  prime_cost_target_pct: number;
  prime_cost_status: 'good' | 'warning' | 'over';
  total_labor_cost: number;
  labor_cost_pct: number;
  labor_cost_target_pct: number;
  total_expected_revenue: number;
  total_expected_covers: number;
  estimated_cogs: number;
  cogs_pct: number;
  revpash: number;
  table_turnover_rate: number;
  avg_check_per_head: number;
  sales_by_day: DayRevenue[];
  sales_by_daypart: DaypartRevenue[];
  high_turnover_risk_count: number;
  turnover_risk_pct: number;
  /** POS integration that last synced data for this site, or null if no sync has occurred */
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

export interface ScheduleCoverageReport {
  schedule_id: number;
  week_start: string;
  days: DailyCoverageReport[];
  total_standby_count: number;
  days_at_risk: number;
}

export interface DayIntelligence {
  date: string;
  day_of_week: number;
  expected_revenue: number;
  expected_covers: number;
  avg_check_per_head: number;
  table_turnover_rate: number;
  optimal_server_count: number;
  actual_server_count: number;
  optimal_kitchen_count: number;
  actual_kitchen_count: number;
  total_scheduled: number;
  understaffed_probability: number;
  overstaffed_probability: number;
  staffing_status: 'adequate' | 'understaffed' | 'overstaffed';
  burnout_alert_count: number;
  burnout_alert_names: string[];
  day_labor_cost: number;
  day_revenue_share: number;
  budget_allocated: number;
  budget_utilization_pct: number;
  budget_status: 'tight' | 'on_track' | 'flexible';
}

export interface ScheduleIntelligence {
  schedule_id: number;
  week_start: string;
  labor_budget: number;
  total_labor_cost: number;
  avg_check_per_head: number;
  table_turnover_rate: number;
  days: DayIntelligence[];
  overall_burnout_alert_count: number;
  budget_flexibility_pct: number;
  budget_status: 'tight' | 'on_track' | 'flexible';
  understaffed_days: number;
  overstaffed_days: number;
}

// ── Open Shifts ──────────────────────────────────────────────────────────────
export const getOpenShifts = (params?: { status?: string; date_from?: string; date_to?: string }) => {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : '';
  return request<OpenShift[]>(`/open-shifts${qs}`);
};
export const getOpenShift = (id: number) => request<OpenShift & { eligibility?: EligibilityInfo }>(`/open-shifts/${id}`);
export const createOpenShift = (data: {
  schedule_id: number; site_id?: number; date: string; start_time: string; end_time: string;
  role: string; required_certifications?: string[]; reason?: string; deadline?: string;
}) => request<OpenShift>('/open-shifts', { method: 'POST', body: JSON.stringify(data) });
export const offerForOpenShift = (id: number) => request<OpenShiftOffer>(`/open-shifts/${id}/offer`, { method: 'POST' });
export const fillOpenShift = (id: number, data: { employee_id: number; offer_id?: number; manager_override?: boolean; manager_notes?: string }) =>
  request<{ open_shift: OpenShift; shift_id: number }>(`/open-shifts/${id}/fill`, { method: 'PUT', body: JSON.stringify(data) });
export const cancelOpenShift = (id: number) => request<{ success: boolean }>(`/open-shifts/${id}`, { method: 'DELETE' });

// ── Callouts ─────────────────────────────────────────────────────────────────
export const getCallouts = (params?: { status?: string; date_from?: string; date_to?: string }) => {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : '';
  return request<CalloutEvent[]>(`/callouts${qs}`);
};
export const reportCallout = (data: { shift_id?: number; employee_id?: number; reason?: string; auto_open_shift?: boolean; manager_notes?: string }) =>
  request<{ callout: CalloutEvent; open_shift_id: number | null }>('/callouts', { method: 'POST', body: JSON.stringify(data) });
export const getEligibleReplacements = (calloutId: number) =>
  request<{ shift: Shift; candidates: EligibleReplacement[] }>(`/callouts/${calloutId}/eligible-replacements`);
export const resolveCallout = (id: number, data: { replacement_employee_id?: number; replacement_status?: string; manager_notes?: string; manager_override?: boolean }) =>
  request<CalloutEvent>(`/callouts/${id}/resolve`, { method: 'PUT', body: JSON.stringify(data) });

// ── Surveys ───────────────────────────────────────────────────────────────────
export const getSurveyTemplates = () => request<SurveyTemplate[]>('/surveys/templates');
export const getSurveyCampaigns = () => request<SurveyCampaign[]>('/surveys/campaigns');
export const createSurveyCampaign = (data: { template_id: number; site_id?: number; title: string; start_date: string; end_date: string; anonymized?: boolean; min_group_size?: number }) =>
  request<SurveyCampaign>('/surveys/campaigns', { method: 'POST', body: JSON.stringify(data) });
export const getSurveyCampaign = (id: number) => request<SurveyCampaign & { questions: SurveyQuestion[]; already_responded: boolean }>(`/surveys/campaigns/${id}`);
export const submitSurveyResponse = (id: number, responses: Record<string, number>) =>
  request<{ success: boolean; message: string }>(`/surveys/campaigns/${id}/respond`, { method: 'POST', body: JSON.stringify({ responses }) });
export const getSurveyResults = (id: number) => request<SurveyResults>(`/surveys/campaigns/${id}/results`);

// ── Feature Flags ─────────────────────────────────────────────────────────────
export const getFeatureFlags = () => request<FeatureFlag[]>('/feature-flags');
export const updateFeatureFlag = (key: string, data: { enabled?: boolean; rollout_pct?: number; site_ids?: number[]; description?: string }) =>
  request<FeatureFlag>(`/feature-flags/${key}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Fairness Analytics ────────────────────────────────────────────────────────
export const getFairnessReport = (params: { schedule_id?: number; site_id?: number; week_start?: string; week_end?: string }) => {
  const qs = '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]) as [string, string][]).toString();
  return request<FairnessReport>(`/fairness${qs}`);
};
export const getInstabilityReport = (params: { schedule_id?: number; site_id?: number; week_start?: string }) => {
  const qs = '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]) as [string, string][]).toString();
  return request<InstabilityReport[]>(`/fairness/instability${qs}`);
};

// ── Schedule Instability (per schedule) ──────────────────────────────────────
export const getScheduleInstability = (id: number) => request<InstabilityReport>(`/schedules/${id}/instability`);

// ── Change Requests ───────────────────────────────────────────────────────────
export const getChangeRequests = () => request<ChangeRequest[]>('/change-requests');
export const createChangeRequest = (data: { shift_id: number; change_type: string; reason_code: string; reason_detail?: string; new_date?: string; new_start_time?: string; new_end_time?: string }) =>
  request<ChangeRequest>('/change-requests', { method: 'POST', body: JSON.stringify(data) });
export const consentChangeRequest = (id: number, decision: 'accepted' | 'rejected') =>
  request<ChangeRequest>(`/change-requests/${id}/consent`, { method: 'PUT', body: JSON.stringify({ decision }) });
export const approveChangeRequest = (id: number, manager_notes?: string) =>
  request<ChangeRequest>(`/change-requests/${id}/approve`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });
export const rejectChangeRequest = (id: number, manager_notes?: string) =>
  request<ChangeRequest>(`/change-requests/${id}/reject`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });

// ── Publish SLA ───────────────────────────────────────────────────────────────
export const getPublishSla = () => request<PublishSla[]>('/publish-sla');
export const upsertPublishSla = (data: { site_id: number; role?: string; advance_days: number }) =>
  request<PublishSla>('/publish-sla', { method: 'POST', body: JSON.stringify(data) });
export const deletePublishSla = (id: number) => request<{ success: boolean }>(`/publish-sla/${id}`, { method: 'DELETE' });

// ── New Types ─────────────────────────────────────────────────────────────────
export interface OpenShift {
  id: number;
  schedule_id: number;
  site_id: number | null;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  required_certifications: string;
  reason: string | null;
  status: 'open' | 'claimed' | 'cancelled' | 'expired';
  deadline: string | null;
  claimed_by: number | null;
  claimed_by_name: string | null;
  offer_count?: number;
  created_at: string;
}

export interface OpenShiftOffer {
  id: number;
  open_shift_id: number;
  employee_id: number;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'ineligible';
  ineligibility_reason: string | null;
  manager_notes: string | null;
  created_at: string;
}

export interface EligibilityInfo {
  eligible: boolean;
  reason: string | null;
  explanation: string;
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

export interface EligibleReplacement {
  employee: Employee;
  eligible: boolean;
  reason: string | null;
  current_weekly_hours?: number;
}

export interface SurveyTemplate {
  id: number;
  instrument: string;
  name: string;
  description: string;
  questions: string;
  active: number;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  scale: number;
  subscale: string;
  reversed?: boolean;
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
  created_at: string;
}

export interface SurveySubscaleResult {
  subscale: string;
  avg_score: number | null;
  item_count: number;
  interpretation: string;
}

export interface SurveyResults {
  campaign_id: number;
  instrument?: string;
  response_count: number;
  min_group_size: number;
  results_available: boolean;
  message?: string;
  subscale_results?: SurveySubscaleResult[];
  purpose_limitation: string;
  data_governance?: string;
}

export interface FeatureFlag {
  id: number;
  flag_key: string;
  description: string;
  enabled: number;
  rollout_pct: number;
  site_ids: string;
  active_for_user?: boolean;
  created_at: string;
  updated_at: string;
}

export interface FairnessEmployee {
  employee_id: number;
  employee_name: string;
  role: string;
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

export interface PosIntegration {
  id: number;
  site_id: number | null;
  platform_name: 'square' | 'toast' | 'clover' | 'lightspeed' | 'revel' | 'other';
  display_name: string;
  status: 'connected' | 'error' | 'disconnected';
  api_key_masked: string;
  webhook_url: string | null;
  last_synced_at: string | null;
  last_sync_status: 'success' | 'error' | null;
  last_sync_revenue: number | null;
  last_sync_covers: number | null;
  created_at: string;
}

export interface PosIntegrationSyncResult {
  integration: PosIntegration;
  synced_dates: number;
  total_revenue_synced: number;
  total_covers_synced: number;
}

export interface GeneratePreviewForecast {
  date: string;
  day_name: string;
  expected_revenue: number;
  expected_covers: number;
  has_data: boolean;
}

export interface GeneratePreview {
  week_start: string;
  site_id: number | null;
  forecasts: GeneratePreviewForecast[];
  total_expected_revenue: number;
  total_expected_covers: number;
  avg_check_per_head: number;
  table_turnover_rate: number;
  estimated_labor_cost: number;
  estimated_cogs: number;
  estimated_prime_cost: number;
  prime_cost_pct: number;
  revpash: number;
  settings: RestaurantSettings;
  has_forecast_data: boolean;
  pos_last_synced: { platform: string; at: string } | null;
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications = (params?: { unread_only?: boolean }) => {
  const qs = params?.unread_only ? '?unread_only=true' : '';
  return request<{ notifications: AppNotification[]; unread_count: number }>(`/notifications${qs}`);
};
export const markNotificationRead = (id: number) =>
  request<AppNotification>(`/notifications/${id}/read`, { method: 'PUT' });
export const markAllNotificationsRead = () =>
  request<{ success: boolean }>('/notifications/read-all', { method: 'PUT' });

// ── Messaging ─────────────────────────────────────────────────────────────────
export const getConversations = () =>
  request<ConversationWithDetails[]>('/messages/conversations');
export const createConversation = (data: { member_ids: number[]; title?: string; type?: 'direct' | 'group' }) =>
  request<Conversation>('/messages/conversations', { method: 'POST', body: JSON.stringify(data) });
export const getConversationMessages = (id: number) =>
  request<{ conversation: Conversation; messages: Message[]; members: ConversationMember[] }>(`/messages/conversations/${id}`);
export const sendMessage = (conversationId: number, body: string) =>
  request<Message>(`/messages/conversations/${conversationId}`, { method: 'POST', body: JSON.stringify({ body }) });
export const markConversationRead = (id: number) =>
  request<{ success: boolean }>(`/messages/conversations/${id}/read`, { method: 'PUT' });

// ── Notification & Message Types ──────────────────────────────────────────────
export interface AppNotification {
  id: number;
  employee_id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  data: string;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  title: string | null;
  site_id: number | null;
  created_by: number | null;
  created_at: string;
  last_message_at: string;
}

export interface ConversationWithDetails extends Conversation {
  message_count: number;
  unread_count: number;
  last_message: string | null;
  members: ConversationMember[];
}

export interface ConversationMember {
  id: number;
  name: string;
  role: string;
  photo_url: string | null;
  last_read_at: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  sender_photo: string | null;
  body: string;
  created_at: string;
}
