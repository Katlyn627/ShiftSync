const BASE = '/api';

function getToken() {
  return localStorage.getItem('shiftsync_token');
}

async function request(path, options) {
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
export const registerEmployee = (data) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify(data) });

// Employees
export const getEmployees = () => request('/employees');
export const createEmployee = (data) =>
  request('/employees', { method: 'POST', body: JSON.stringify(data) });
export const updateEmployee = (id, data) =>
  request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteEmployee = (id) =>
  request(`/employees/${id}`, { method: 'DELETE' });

export const getAvailability = (empId) =>
  request(`/employees/${empId}/availability`);
export const getEmployeeStats = (employeeId, scheduleId) =>
  request(`/employees/${employeeId}/stats?schedule_id=${scheduleId}`);
export const setAvailability = (empId, data) =>
  request(`/employees/${empId}/availability`, { method: 'POST', body: JSON.stringify(data) });
export const deleteAvailability = (empId, dayOfWeek) =>
  request(`/employees/${empId}/availability/${dayOfWeek}`, { method: 'DELETE' });

// Schedules
export const getSchedules = () => request('/schedules');
export const generateSchedule = (week_start, labor_budget) =>
  request('/schedules/generate', { method: 'POST', body: JSON.stringify({ week_start, labor_budget }) });
export const getScheduleShifts = (id) => request(`/schedules/${id}/shifts`);
export const getLaborCost = (id) => request(`/schedules/${id}/labor-cost`);
export const getBurnoutRisks = (id) => request(`/schedules/${id}/burnout-risks`);
export const getTurnoverRisks = (id) => request(`/schedules/${id}/turnover-risks`);
export const updateSchedule = (id, data) =>
  request(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSchedule = (id) =>
  request(`/schedules/${id}`, { method: 'DELETE' });

// Shifts
export const updateShift = (id, data) =>
  request(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const createShift = (data) =>
  request('/shifts', { method: 'POST', body: JSON.stringify(data) });
export const deleteShift = (id) =>
  request(`/shifts/${id}`, { method: 'DELETE' });

// Swaps
export const getSwaps = () => request('/swaps');
export const createSwap = (data) =>
  request('/swaps', { method: 'POST', body: JSON.stringify(data) });
export const approveSwap = (id, manager_notes) =>
  request(`/swaps/${id}/approve`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });
export const rejectSwap = (id, manager_notes) =>
  request(`/swaps/${id}/reject`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });

// Forecasts
export const getForecasts = () => request('/forecasts');
export const upsertForecast = (data) =>
  request('/forecasts', { method: 'POST', body: JSON.stringify(data) });
export const getStaffingSuggestions = (week_start) =>
  request(`/schedules/staffing-suggestions?week_start=${week_start}`);

// Time-off requests
export const getTimeOffRequests = () => request('/time-off');
export const createTimeOffRequest = (data) =>
  request('/time-off', { method: 'POST', body: JSON.stringify(data) });
export const approveTimeOffRequest = (id, manager_notes) =>
  request(`/time-off/${id}/approve`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });
export const rejectTimeOffRequest = (id, manager_notes) =>
  request(`/time-off/${id}/reject`, { method: 'PUT', body: JSON.stringify({ manager_notes }) });
export const cancelTimeOffRequest = (id) =>
  request(`/time-off/${id}`, { method: 'DELETE' });

// Types

