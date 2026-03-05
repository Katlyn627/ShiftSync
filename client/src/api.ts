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
export const setAvailability = (empId: number, data: Omit<Availability, 'id' | 'employee_id'>) =>
  request<Availability>(`/employees/${empId}/availability`, { method: 'POST', body: JSON.stringify(data) });
export const deleteAvailability = (empId: number, dayOfWeek: number) =>
  request<{ success: boolean }>(`/employees/${empId}/availability/${dayOfWeek}`, { method: 'DELETE' });

// Schedules
export const getSchedules = () => request<Schedule[]>('/schedules');
export const generateSchedule = (week_start: string, labor_budget: number) =>
  request<Schedule>('/schedules/generate', { method: 'POST', body: JSON.stringify({ week_start, labor_budget }) });
export const getScheduleShifts = (id: number) => request<ShiftWithEmployee[]>(`/schedules/${id}/shifts`);
export const getLaborCost = (id: number) => request<LaborCostSummary>(`/schedules/${id}/labor-cost`);
export const getBurnoutRisks = (id: number) => request<BurnoutRisk[]>(`/schedules/${id}/burnout-risks`);
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

// Profitability Metrics
export const getProfitabilityMetrics = (scheduleId: number) =>
  request<ProfitabilityMetrics>(`/schedules/${scheduleId}/profitability-metrics`);

// Coverage / Standby
export const getScheduleCoverage = (scheduleId: number) =>
  request<ScheduleCoverageReport>(`/schedules/${scheduleId}/coverage`);

// Types
export interface Employee {
  id: number;
  name: string;
  role: string;
  hourly_rate: number;
  weekly_hours_max: number;
  email?: string;
  phone?: string;
  photo_url?: string | null;
  created_at: string;
}

export interface Availability {
  id: number;
  employee_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Schedule {
  id: number;
  week_start: string;
  labor_budget: number;
  status: string;
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
  labor_cost: number;
  covers: number;
}

export interface ProfitabilityMetrics {
  schedule_id: number;
  week_start: string;
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
  sales_by_daypart: DaypartRevenue[];
  high_turnover_risk_count: number;
  turnover_risk_pct: number;
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
