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
export const getTurnoverRisks = (id: number) => request<TurnoverRisk[]>(`/schedules/${id}/turnover-risks`);
export const getEmployeeStats = (employeeId: number, scheduleId: number) =>
  request<EmployeeStats>(`/employees/${employeeId}/stats?schedule_id=${scheduleId}`);

// Shifts
export const updateShift = (id: number, data: Partial<Shift>) =>
  request<Shift>(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) });

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

// Types
export interface Employee {
  id: number;
  name: string;
  role: string;
  hourly_rate: number;
  weekly_hours_max: number;
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

export interface TurnoverRisk {
  employee_id: number;
  employee_name: string;
  risk_level: 'low' | 'medium' | 'high';
  risk_score: number;
  factors: string[];
  weekly_hours: number;
  hours_utilization_pct: number;
}

export interface EmployeeStats {
  employee: Employee;
  schedule_id: number;
  weekly_hours: number;
  labor_cost: number;
  labor_pct_of_budget: number;
  shifts: Shift[];
  burnout: BurnoutRisk | null;
  turnover: TurnoverRisk | null;
}
