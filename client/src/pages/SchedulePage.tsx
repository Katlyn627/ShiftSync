import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, PencilLine, Plus, Printer, Sparkles, Trash2 } from 'lucide-react';
import {
  createOpenShift,
  createShift,
  createSwap,
  deleteSchedule,
  deleteShift,
  dropShift,
  duplicateSchedule,
  Availability,
  Employee,
  generateSchedule,
  getAllAvailability,
  getEmployees,
  getOpenShifts,
  getScheduleShifts,
  getSchedules,
  getStaffingSuggestions,
  getTimeOffRequests,
  offerForOpenShift,
  OpenShift,
  Schedule,
  ShiftWithEmployee,
  StaffingNeed,
  DailyStaffingSuggestion,
  TimeOffRequest,
  updateSchedule,
  updateShift,
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Input, Modal, NATIVE_SELECT_CLASS, PageHeader, useToast } from '../components/ui';

function getCurrentWeekStartISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getNextWeekStartISO(baseDate?: string) {
  const d = baseDate ? new Date(`${baseDate}T12:00:00Z`) : new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

function toSortableValue(shift: ShiftWithEmployee) {
  return `${shift.date} ${shift.start_time}`;
}

function toISODate(date: Date) {
  const adjusted = new Date(date);
  adjusted.setMinutes(adjusted.getMinutes() - adjusted.getTimezoneOffset());
  return adjusted.toISOString().split('T')[0];
}

function normalizedValue(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function employeeDepartmentLabel(employee: Employee): string {
  return (employee.department || employee.role || 'General').trim();
}

function calculateRestHoursClient(
  shiftA: { date: string; start_time: string; end_time: string },
  shiftB: { date: string; start_time: string; end_time: string }
): number {
  const [y1, m1, d1] = shiftA.date.split('-').map(Number);
  const [y2, m2, d2] = shiftB.date.split('-').map(Number);
  const [shA, smA] = shiftA.start_time.split(':').map(Number);
  const [ehA, emA] = shiftA.end_time.split(':').map(Number);
  const startA = shA * 60 + smA;
  let endA = ehA * 60 + emA;
  const overnightA = endA <= startA;

  const endDateA = new Date(Date.UTC(y1, m1 - 1, d1 + (overnightA ? 1 : 0), Math.floor(endA % (24 * 60) / 60), endA % 60));
  const [shB, smB] = shiftB.start_time.split(':').map(Number);
  const startB = shB * 60 + smB;
  const startDateB = new Date(Date.UTC(y2, m2 - 1, d2, Math.floor(startB / 60), startB % 60));

  const diffMs = startDateB.getTime() - endDateA.getTime();
  return diffMs / (1000 * 60 * 60);
}

function getShiftIntervalMsClient(shift: { date: string; start_time: string; end_time: string }): { startMs: number; endMs: number } {
  const [y, m, d] = shift.date.split('-').map(Number);
  const [sh, sm] = shift.start_time.split(':').map(Number);
  const [eh, em] = shift.end_time.split(':').map(Number);
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  const overnight = endMin <= startMin;

  const startDate = new Date(Date.UTC(y, m - 1, d, Math.floor(startMin / 60), startMin % 60));
  const endDate = new Date(Date.UTC(y, m - 1, d + (overnight ? 1 : 0), Math.floor(endMin / 60), endMin % 60));

  return {
    startMs: startDate.getTime(),
    endMs: endDate.getTime(),
  };
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
}

function formatTime12(time: string) {
  const normalized = typeof time === 'string' ? time.trim() : '';
  if (!/^\d{2}:\d{2}$/.test(normalized)) return time;
  const [h = '0', m = '00'] = normalized.split(':');
  const date = new Date();
  date.setHours(Number(h), Number(m), 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function createTimeOptions(stepMinutes = 30) {
  const options: { value: string; label: string }[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const date = new Date();
    date.setHours(h, m, 0, 0);
    const label = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    options.push({ value, label });
  }
  return options;
}

const DEFAULT_ROLES = ['Server', 'Kitchen', 'Bar', 'Host', 'Manager'];
const EDIT_INPUT_CLASS = 'w-full rounded-md border border-input bg-background px-2 py-1';
const TIME_OPTIONS = createTimeOptions();
const DEFAULT_SCHEDULE_LABOR_BUDGET = 5000;
const MIN_SCHEDULE_LABOR_BUDGET = 1;
const WEEK_DAY_COLUMN_MIN_WIDTH = 220;

function getShiftDurationHours(startTime: string, endTime: string): number {
  const [startHour = 0, startMinute = 0] = startTime.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = endTime.split(':').map(Number);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

type CandidateRecommendation = {
  employee: Employee;
  score: number;
  reasons: string[];
};

type NeedRecommendation = StaffingNeed & {
  roleLabel: string;
  candidates: CandidateRecommendation[];
};

type DayRecommendation = DailyStaffingSuggestion & {
  recommendedNeeds: NeedRecommendation[];
  extraNeeds: number;
};

const ROLE_ACCENTS: Record<string, { text: string; border: string; chip: string }> = {
  manager: { text: 'text-violet-700', border: 'border-l-violet-500', chip: 'bg-violet-100 text-violet-800' },
  server: { text: 'text-blue-700', border: 'border-l-blue-500', chip: 'bg-blue-100 text-blue-800' },
  bartender: { text: 'text-emerald-700', border: 'border-l-emerald-500', chip: 'bg-emerald-100 text-emerald-800' },
  host: { text: 'text-pink-700', border: 'border-l-pink-500', chip: 'bg-pink-100 text-pink-800' },
  kitchen: { text: 'text-orange-700', border: 'border-l-orange-500', chip: 'bg-orange-100 text-orange-800' },
  busser: { text: 'text-cyan-700', border: 'border-l-cyan-500', chip: 'bg-cyan-100 text-cyan-800' },
  'food runner': { text: 'text-sky-700', border: 'border-l-sky-500', chip: 'bg-sky-100 text-sky-800' },
  expo: { text: 'text-fuchsia-700', border: 'border-l-fuchsia-500', chip: 'bg-fuchsia-100 text-fuchsia-800' },
  'head chef': { text: 'text-red-700', border: 'border-l-red-500', chip: 'bg-red-100 text-red-800' },
  'sous chef': { text: 'text-amber-700', border: 'border-l-amber-500', chip: 'bg-amber-100 text-amber-800' },
  'line cook': { text: 'text-lime-700', border: 'border-l-lime-500', chip: 'bg-lime-100 text-lime-800' },
  dishwasher: { text: 'text-slate-700', border: 'border-l-slate-500', chip: 'bg-slate-100 text-slate-800' },
  default: { text: 'text-slate-700', border: 'border-l-slate-400', chip: 'bg-slate-100 text-slate-800' },
};

function normalizeStaffingRole(role: string) {
  const normalized = normalizedValue(role);
  if (normalized === 'bar') return 'bartender';
  return normalized;
}

function getRoleAccent(role: string) {
  return ROLE_ACCENTS[normalizeStaffingRole(role)] ?? ROLE_ACCENTS.default;
}

function formatRoleLabel(role: string) {
  if (normalizeStaffingRole(role) === 'bartender') return 'Bartender';
  return role;
}

function parseIsoDateValue(date: string) {
  return new Date(`${date}T12:00:00`);
}

function isDateBetween(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

function availabilityCoversShift(entry: Availability, shiftStart: string, shiftEnd: string) {
  if (entry.availability_type === 'unavailable') return false;
  if (entry.availability_type === 'open') return true;
  const start = parseShiftMinutes(entry.start_time || '00:00');
  let end = parseShiftMinutes(entry.end_time || '23:59');
  const shiftStartMinutes = parseShiftMinutes(shiftStart);
  let shiftEndMinutes = parseShiftMinutes(shiftEnd);
  if (shiftEndMinutes <= shiftStartMinutes) shiftEndMinutes += 24 * 60;
  if (end <= start) end += 24 * 60;
  return start <= shiftStartMinutes && end >= shiftEndMinutes;
}

function parseShiftMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.isManager ?? false;

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [newScheduleWeekStart, setNewScheduleWeekStart] = useState(getCurrentWeekStartISO());
  const [newScheduleLaborBudget, setNewScheduleLaborBudget] = useState(String(DEFAULT_SCHEDULE_LABOR_BUDGET));

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalTab, setScheduleModalTab] = useState<'copy' | 'generate'>('copy');
  const [targetWeekStart, setTargetWeekStart] = useState(getCurrentWeekStartISO());
  const [targetLaborBudget, setTargetLaborBudget] = useState(String(DEFAULT_SCHEDULE_LABOR_BUDGET));
  const [submittingScheduleModal, setSubmittingScheduleModal] = useState(false);

  const [newShift, setNewShift] = useState({
    employee_id: '',
    date: getCurrentWeekStartISO(),
    start_time: '09:00',
    end_time: '17:00',
    role: 'Server',
  });
  const [creatingShift, setCreatingShift] = useState(false);

  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    employee_id: '',
    date: '',
    start_time: '',
    end_time: '',
    role: '',
  });

  const [employeeViewMode, setEmployeeViewMode] = useState<'weekly' | 'daily'>('weekly');
  const [managerScheduleView, setManagerScheduleView] = useState<'weekly' | 'daily'>('weekly');
  const [selectedDay, setSelectedDay] = useState(toISODate(new Date()));
  const [selectedRecommendationDay, setSelectedRecommendationDay] = useState<string>('');

  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [claimingOpenShiftId, setClaimingOpenShiftId] = useState<number | null>(null);
  const [submittingShiftActionId, setSubmittingShiftActionId] = useState<number | null>(null);
  const [swapDraftShiftId, setSwapDraftShiftId] = useState<number | null>(null);
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('all');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [staffingSuggestions, setStaffingSuggestions] = useState<DailyStaffingSuggestion[]>([]);

  const [draggedEmployeeId, setDraggedEmployeeId] = useState<number | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);

  const roleOptions = useMemo(() => {
    const roles = new Set<string>(DEFAULT_ROLES);
    employees.forEach((e) => roles.add(e.role));
    shifts.forEach((s) => roles.add(s.role));
    return Array.from(roles).sort((a, b) => a.localeCompare(b));
  }, [employees, shifts]);

  const selectedSchedule = useMemo(
    () => schedules.find((s) => s.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId],
  );

  const currentEmployee = useMemo(
    () => employees.find((e) => e.id === user?.employeeId) ?? null,
    [employees, user?.employeeId],
  );

  const currentEmployeeDepartment = normalizedValue(currentEmployee?.department);
  const currentEmployeeRole = normalizedValue(currentEmployee?.role ?? user?.employeeRole);
  const normalizedDepartmentFilter = normalizedValue(selectedDepartmentFilter);
  const selectedEmployeeFilterId = selectedEmployeeFilter === 'all' ? null : Number(selectedEmployeeFilter);

  const selectedEmployeeForManager = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeFilterId) ?? null,
    [employees, selectedEmployeeFilterId],
  );

  const departmentOptions = useMemo(() => {
    const options = new Set<string>();

    employees.forEach((employee) => {
      const label = employeeDepartmentLabel(employee);
      if (label) options.add(label);
    });

    shifts.forEach((shift) => {
      const label = (shift.employee_department || shift.employee_role || shift.role || '').trim();
      if (label) options.add(label);
    });

    openShifts.forEach((shift) => {
      const label = ((shift as OpenShift & { department?: string | null }).department || shift.role || '').trim();
      if (label) options.add(label);
    });

    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [employees, shifts, openShifts]);

  const visibleShifts = useMemo(() => {
    const base = [...shifts].sort((a, b) => toSortableValue(a).localeCompare(toSortableValue(b)));
    if (isManager) {
      const byDepartment = normalizedDepartmentFilter === 'all'
        ? base
        : base.filter((shift) => {
          const shiftDepartment = normalizedValue(shift.employee_department || shift.employee_role || shift.role);
          return shiftDepartment === normalizedDepartmentFilter;
        });
      if (!selectedEmployeeFilterId) return byDepartment;
      return byDepartment.filter((shift) => shift.employee_id === selectedEmployeeFilterId);
    }
    return base.filter((s) => s.employee_id === user?.employeeId);
  }, [shifts, isManager, normalizedDepartmentFilter, selectedEmployeeFilterId, user?.employeeId]);

  const managerSelectedEmployeeShifts = useMemo(() => {
    if (!isManager || !selectedEmployeeFilterId) return [];
    return shifts.filter((shift) => shift.employee_id === selectedEmployeeFilterId);
  }, [isManager, selectedEmployeeFilterId, shifts]);

  const managerSelectedEmployeeHours = useMemo(() => {
    if (!selectedEmployeeFilterId) return 0;
    return managerSelectedEmployeeShifts.reduce((total, shift) => {
      return total + getShiftDurationHours(shift.start_time, shift.end_time);
    }, 0);
  }, [managerSelectedEmployeeShifts, selectedEmployeeFilterId]);

  const managerSelectedEmployeeTimeOff = useMemo(() => {
    if (!isManager || !selectedEmployeeFilterId) return [];
    return timeOffRequests.filter((request) => {
      return request.employee_id === selectedEmployeeFilterId && request.status === 'approved';
    });
  }, [isManager, selectedEmployeeFilterId, timeOffRequests]);

  const managerSelectedEmployeeUnavailableDays = useMemo(() => {
    if (!isManager || !selectedEmployeeFilterId) return [];
    return availability.filter((entry) => {
      return entry.employee_id === selectedEmployeeFilterId && entry.availability_type === 'unavailable';
    });
  }, [availability, isManager, selectedEmployeeFilterId]);

  const managerSelectedEmployeeSummary = useMemo(() => {
    if (!selectedEmployeeForManager) return null;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      name: selectedEmployeeForManager.name,
      scheduledHoursLabel: `${managerSelectedEmployeeHours.toFixed(1)}h scheduled (max ${selectedEmployeeForManager.weekly_hours_max}h)`,
      approvedTimeOffLabels: managerSelectedEmployeeTimeOff.map((request) => {
        return `Time-Off Approved: ${request.start_date}${request.end_date !== request.start_date ? ` to ${request.end_date}` : ''}`;
      }),
      unavailableLabels: managerSelectedEmployeeUnavailableDays.map((entry) => `Unavailable: ${dayNames[entry.day_of_week] || `Day ${entry.day_of_week}`}`),
    };
  }, [
    managerSelectedEmployeeHours,
    managerSelectedEmployeeTimeOff,
    managerSelectedEmployeeUnavailableDays,
    selectedEmployeeForManager,
  ]);

  const weekMetadata = useMemo(() => {
    const anchor = selectedSchedule?.week_start
      ? new Date(`${selectedSchedule.week_start}T12:00:00`)
      : visibleShifts[0]?.date
        ? new Date(`${visibleShifts[0].date}T12:00:00`)
        : new Date();
    const weekStartDate = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStartDate);
      d.setDate(weekStartDate.getDate() + i);
      return {
        date: toISODate(d),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });
    return {
      label: `${days[0].dayLabel} - ${days[6].dayLabel}`,
      weekStartISO: days[0].date,
      weekEndISO: days[6].date,
      days,
    };
  }, [selectedSchedule?.week_start, visibleShifts]);

  const activeScheduleView = isManager ? managerScheduleView : employeeViewMode;
  const isCompactWeeklyManagerView = isManager && activeScheduleView === 'weekly';

  const scheduleDays = useMemo(() => {
    if (activeScheduleView === 'weekly') return weekMetadata.days;
    const d = new Date(`${selectedDay}T12:00:00`);
    return [{
      date: selectedDay,
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }];
  }, [activeScheduleView, selectedDay, weekMetadata.days]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftWithEmployee[]>();
    visibleShifts.forEach((shift) => {
      const existing = map.get(shift.date);
      if (existing) {
        existing.push(shift);
      } else {
        map.set(shift.date, [shift]);
      }
    });
    return map;
  }, [visibleShifts]);

  const staffingStatusByDate = useMemo(() => {
    const map = new Map<string, {
      status: 'adequate' | 'understaffed' | 'overstaffed';
      delta: number;
      suggested: number;
      actual: number;
      roleDeltas: Array<{ role: string; delta: number; suggested: number; actual: number }>;
    }>();
    staffingSuggestions.forEach((day) => {
      const suggested = day.staffing_suggested ?? day.staffing.reduce((total, slot) => total + slot.count, 0);
      const actual = day.staffing_actual ?? suggested + (day.staffing_delta ?? 0);
      const delta = day.staffing_delta ?? (actual - suggested);
      const status = day.staffing_status ?? (delta < 0 ? 'understaffed' : delta > 0 ? 'overstaffed' : 'adequate');
      const roleDeltas = day.role_deltas ?? [];
      map.set(day.date, { status, delta, suggested, actual, roleDeltas });
    });
    return map;
  }, [staffingSuggestions]);

  const weeklyStaffingSignal = useMemo(() => {
    let understaffedDays = 0;
    let overstaffedDays = 0;
    staffingStatusByDate.forEach((signal) => {
      if (signal.status === 'understaffed') understaffedDays += 1;
      if (signal.status === 'overstaffed') overstaffedDays += 1;
    });
    return { understaffedDays, overstaffedDays };
  }, [staffingStatusByDate]);

  const weeklyRoleContributors = useMemo(() => {
    const totals = new Map<string, number>();
    staffingStatusByDate.forEach((signal) => {
      signal.roleDeltas.forEach((roleDelta) => {
        totals.set(roleDelta.role, (totals.get(roleDelta.role) || 0) + roleDelta.delta);
      });
    });
    const under = Array.from(totals.entries())
      .map(([role, delta]) => ({ role, delta }))
      .filter((entry) => entry.delta < 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const over = Array.from(totals.entries())
      .map(([role, delta]) => ({ role, delta }))
      .filter((entry) => entry.delta > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return { under, over };
  }, [staffingStatusByDate]);

  const staffingRecommendations = useMemo<DayRecommendation[]>(() => {
    if (!isManager) return [];

    const hoursByEmployee = new Map<number, number>();
    const shiftsByEmployee = new Map<number, ShiftWithEmployee[]>();
    const shiftsByEmployeeAndDate = new Map<string, ShiftWithEmployee[]>();

    shifts.forEach((shift) => {
      if (!shift.employee_id) return;
      hoursByEmployee.set(shift.employee_id, (hoursByEmployee.get(shift.employee_id) || 0) + getShiftDurationHours(shift.start_time, shift.end_time));
      const byEmployee = shiftsByEmployee.get(shift.employee_id) || [];
      byEmployee.push(shift);
      shiftsByEmployee.set(shift.employee_id, byEmployee);

      const dayKey = `${shift.employee_id}:${shift.date}`;
      const byEmployeeDay = shiftsByEmployeeAndDate.get(dayKey) || [];
      byEmployeeDay.push(shift);
      shiftsByEmployeeAndDate.set(dayKey, byEmployeeDay);
    });

    return staffingSuggestions.map((day) => {
      const recommendedNeeds = [...day.staffing]
        .sort((a, b) => b.count - a.count || a.start.localeCompare(b.start))
        .slice(0, 3)
        .map((need) => {
          const roleKey = normalizeStaffingRole(need.role);
          const candidates = employees
            .map((employee) => {
              const employeeRoleKey = normalizeStaffingRole(employee.role);
              const employeeDepartmentKey = normalizeStaffingRole(employee.department || '');
              const matchRole = employeeRoleKey === roleKey;
              const matchDepartment = employeeDepartmentKey === roleKey;
              const timeOffConflict = timeOffRequests.some((request) => {
                if (request.employee_id !== employee.id || request.status !== 'approved') return false;
                return isDateBetween(day.date, request.start_date, request.end_date);
              });
              const availabilityEntries = availability.filter((entry) => entry.employee_id === employee.id && entry.day_of_week === day.day_of_week);
              const availabilityMatch = availabilityEntries.length === 0
                ? true
                : availabilityEntries.some((entry) => availabilityCoversShift(entry, need.start, need.end));
              const sameDayShifts = shiftsByEmployeeAndDate.get(`${employee.id}:${day.date}`) || [];
              const overlapConflict = sameDayShifts.some((shift) => {
                const shiftStart = parseShiftMinutes(shift.start_time);
                let shiftEnd = parseShiftMinutes(shift.end_time);
                const needStart = parseShiftMinutes(need.start);
                let needEnd = parseShiftMinutes(need.end);
                if (shiftEnd <= shiftStart) shiftEnd += 24 * 60;
                if (needEnd <= needStart) needEnd += 24 * 60;
                return shiftStart < needEnd && shiftEnd > needStart;
              });
              const weeklyHours = hoursByEmployee.get(employee.id) || 0;
              const maxHours = employee.weekly_hours_max || 40;
              const loadRatio = maxHours > 0 ? weeklyHours / maxHours : 0;
              const currentDayLoad = sameDayShifts.length;

              let score = 0;
              const reasons: string[] = [];

              if (matchRole) {
                score += 50;
                reasons.push('role match');
              } else if (matchDepartment) {
                score += 28;
                reasons.push('department match');
              } else {
                score -= 20;
              }

              if (availabilityMatch) {
                score += 18;
                reasons.push('available');
              } else {
                score -= 35;
              }

              if (timeOffConflict) {
                score -= 120;
                reasons.push('approved time off');
              }

              if (overlapConflict) {
                score -= 100;
                reasons.push('shift conflict');
              }

              if (currentDayLoad === 0) {
                score += 8;
                reasons.push('free that day');
              } else if (currentDayLoad === 1) {
                score += 3;
              } else {
                score -= 10;
              }

              if (loadRatio < 0.7) {
                score += 12;
                reasons.push('light weekly load');
              } else if (loadRatio > 0.95) {
                score -= 18;
                reasons.push('near weekly max');
              }

              if (weeklyHours + getShiftDurationHours(need.start, need.end) > maxHours) {
                score -= 60;
                reasons.push('would exceed weekly max');
              }

              if (matchRole && availabilityMatch && !timeOffConflict && !overlapConflict) {
                score += 10;
              }

              return {
                employee,
                score,
                reasons,
              };
            })
            .filter((candidate) => candidate.score > -40)
            .sort((a, b) => b.score - a.score || a.employee.name.localeCompare(b.employee.name))
            .slice(0, 3);

          return {
            ...need,
            roleLabel: formatRoleLabel(need.role),
            candidates,
          };
        });

      return {
        ...day,
        recommendedNeeds,
        extraNeeds: Math.max(day.staffing.length - recommendedNeeds.length, 0),
      };
    });
  }, [availability, employees, isManager, staffingSuggestions, shifts, timeOffRequests]);

  // Identify shifts with rest-window violations (< 11 hours rest from previous shift for the same employee)
  const quickReturnShiftMap = useMemo(() => {
    const map = new Map<number, { restHours: number; prevShiftSummary: string }>();
    // Group all active shifts by employee
    const byEmployee = new Map<number, ShiftWithEmployee[]>();
    shifts.forEach((s) => {
      if (!s.employee_id) return;
      const list = byEmployee.get(s.employee_id) || [];
      list.push(s);
      byEmployee.set(s.employee_id, list);
    });

    byEmployee.forEach((empShifts) => {
      // Sort chronologically
      const sorted = [...empShifts].sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const rest = calculateRestHoursClient(prev, curr);
        if (rest >= 0 && rest < 11) {
          map.set(curr.id, {
            restHours: Math.round(rest * 10) / 10,
            prevShiftSummary: `${prev.date} (${formatTime12(prev.start_time)}-${formatTime12(prev.end_time)})`,
          });
        }
      }
    });

    return map;
  }, [shifts]);

  // Identify shifts that overlap in time with another shift for the same employee
  const overlappingShiftIds = useMemo(() => {
    const conflictSet = new Set<number>();
    const byEmployee = new Map<number, ShiftWithEmployee[]>();
    shifts.forEach((s) => {
      if (!s.employee_id) return;
      const list = byEmployee.get(s.employee_id) || [];
      list.push(s);
      byEmployee.set(s.employee_id, list);
    });

    byEmployee.forEach((empShifts) => {
      for (let i = 0; i < empShifts.length; i++) {
        for (let j = i + 1; j < empShifts.length; j++) {
          const shiftA = empShifts[i];
          const shiftB = empShifts[j];
          const intA = getShiftIntervalMsClient(shiftA);
          const intB = getShiftIntervalMsClient(shiftB);
          if (intA.startMs < intB.endMs && intA.endMs > intB.startMs) {
            conflictSet.add(shiftA.id);
            conflictSet.add(shiftB.id);
          }
        }
      }
    });

    return conflictSet;
  }, [shifts]);

  const openShiftsByDate = useMemo(() => {
    const scopedOpenShifts = isManager
      ? (normalizedDepartmentFilter === 'all'
        ? openShifts
        : openShifts.filter((shift) => {
          const shiftDepartment = normalizedValue((shift as OpenShift & { department?: string | null }).department || shift.role);
          return shiftDepartment === normalizedDepartmentFilter;
        }))
      : openShifts.filter((shift) => {
        const shiftDepartment = normalizedValue((shift as OpenShift & { department?: string | null }).department);
        if (currentEmployeeDepartment && shiftDepartment) {
          return shiftDepartment === currentEmployeeDepartment;
        }
        if (currentEmployeeRole) {
          return normalizedValue(shift.role) === currentEmployeeRole;
        }
        return true;
      });
    const map = new Map<string, OpenShift[]>();
    scopedOpenShifts.forEach((shift) => {
      const existing = map.get(shift.date);
      if (existing) {
        existing.push(shift);
      } else {
        map.set(shift.date, [shift]);
      }
    });
    return map;
  }, [openShifts, isManager, currentEmployeeDepartment, currentEmployeeRole, normalizedDepartmentFilter]);

  const departmentTone = (department: string) => {
    const tones = [
      'border-blue-200 bg-blue-50/70',
      'border-purple-200 bg-purple-50/70',
      'border-emerald-200 bg-emerald-50/70',
      'border-amber-200 bg-amber-50/70',
      'border-cyan-200 bg-cyan-50/70',
      'border-rose-200 bg-rose-50/70',
    ];
    const key = (department || '').toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    return tones[Math.abs(hash) % tones.length];
  };

  const departmentGroupOrder = ['Management', 'Front of House', 'Back of House'];

  const getDepartmentGroupLabel = (value: string | null | undefined) => {
    const normalized = normalizedValue(value || '');
    if (!normalized) return 'General';
    if (['management', 'operations', 'leadership', 'owner', 'supervisor'].some((term) => normalized.includes(term))) return 'Management';
    if (['front of house', 'foh', 'server', 'host', 'bartender', 'bar', 'cashier', 'support', 'busser'].some((term) => normalized.includes(term))) return 'Front of House';
    if (['back of house', 'boh', 'kitchen', 'dishwasher', 'cook', 'chef', 'expo', 'prep'].some((term) => normalized.includes(term))) return 'Back of House';
    return 'Management';
  };

  const getShiftDisplayGroup = (shift: ShiftWithEmployee) =>
    shift.employee_department || shift.employee_role || shift.role;

  const sortDepartmentGroups = <T extends { department: string; items: any[] }>(groups: T[]) =>
    [...groups].sort((a, b) => {
      const aIndex = departmentGroupOrder.indexOf(a.department);
      const bIndex = departmentGroupOrder.indexOf(b.department);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

  async function loadSchedules() {
    const list = await getSchedules();
    setSchedules(list);
    setSelectedScheduleId((prev) => {
      if (prev && list.some((s) => s.id === prev)) return prev;
      return list.length > 0 ? list[0].id : null;
    });
  }

  async function loadShifts(scheduleId: number) {
    const list = await getScheduleShifts(scheduleId);
    setShifts(list);
  }

  async function loadOpenShifts() {
    const list = await getOpenShifts({
      status: 'open',
      date_from: weekMetadata.weekStartISO,
      date_to: weekMetadata.weekEndISO,
    });
    setOpenShifts(list);
  }

  useEffect(() => {
    const availabilityPromise = typeof getAllAvailability === 'function'
      ? getAllAvailability().then(setAvailability).catch(() => setAvailability([]))
      : Promise.resolve(setAvailability([]));
    const timeOffPromise = typeof getTimeOffRequests === 'function'
      ? getTimeOffRequests().then(setTimeOffRequests).catch(() => setTimeOffRequests([]))
      : Promise.resolve(setTimeOffRequests([]));
    Promise.all([
      loadSchedules(),
      getEmployees().then(setEmployees).catch(() => setEmployees([])),
      availabilityPromise,
      timeOffPromise,
    ])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedScheduleId) {
      setShifts([]);
      return;
    }
    loadShifts(selectedScheduleId).catch(() => setShifts([]));
  }, [selectedScheduleId]);

  useEffect(() => {
    if (!selectedSchedule?.week_start) {
      setStaffingSuggestions([]);
      return;
    }
    getStaffingSuggestions(selectedSchedule.week_start)
      .then(setStaffingSuggestions)
      .catch(() => setStaffingSuggestions([]));
  }, [selectedSchedule?.week_start]);

  useEffect(() => {
    if (!selectedSchedule) return;
    setNewShift((prev) => ({ ...prev, date: selectedSchedule.week_start }));
    setSelectedDay(selectedSchedule.week_start);
  }, [selectedSchedule]);

  useEffect(() => {
    if (staffingRecommendations.length === 0) {
      setSelectedRecommendationDay('');
      return;
    }
    setSelectedRecommendationDay((current) => {
      if (current && staffingRecommendations.some((day) => day.date === current)) return current;
      return staffingRecommendations[0].date;
    });
  }, [staffingRecommendations]);

  useEffect(() => {
    loadOpenShifts().catch(() => setOpenShifts([]));
  }, [weekMetadata.weekStartISO, weekMetadata.weekEndISO, selectedScheduleId]);

  async function handleTogglePublish() {
    if (!isManager || !selectedSchedule) return;
    const newStatus = selectedSchedule.status === 'published' ? 'draft' : 'published';
    try {
      await updateSchedule(selectedSchedule.id, { status: newStatus });
      await loadSchedules();
      toast(`Schedule ${newStatus === 'published' ? 'published' : 'set to draft'}.`, { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to update schedule status.', { variant: 'error' });
    }
  }

  async function handleDeleteSchedule() {
    if (!isManager || !selectedSchedule) return;
    if (!confirm('Delete this schedule and all shifts?')) return;
    try {
      await deleteSchedule(selectedSchedule.id);
      await loadSchedules();
      toast('Schedule deleted.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to delete schedule.', { variant: 'error' });
    }
  }

  async function handleGenerateSchedule() {
    if (!isManager) return;
    if (!newScheduleWeekStart) {
      toast('Select a week start date.', { variant: 'warning' });
      return;
    }
    const laborBudget = Number(newScheduleLaborBudget);
    if (!Number.isInteger(laborBudget) || laborBudget < MIN_SCHEDULE_LABOR_BUDGET) {
      toast(`Enter a whole-number labor budget of at least ${MIN_SCHEDULE_LABOR_BUDGET}.`, { variant: 'warning' });
      return;
    }
    setCreatingSchedule(true);
    try {
      const created = await generateSchedule(newScheduleWeekStart, laborBudget);
      await loadSchedules();
      setSelectedScheduleId(created.id);
      toast('Schedule generated.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to generate schedule.', { variant: 'error' });
    } finally {
      setCreatingSchedule(false);
    }
  }

  function openNewScheduleModal() {
    const nextWeek = getNextWeekStartISO(selectedSchedule?.week_start);
    setTargetWeekStart(nextWeek);
    setTargetLaborBudget(String(selectedSchedule?.labor_budget || DEFAULT_SCHEDULE_LABOR_BUDGET));
    setScheduleModalTab('copy');
    setIsScheduleModalOpen(true);
  }

  async function handleDuplicateSchedule() {
    if (!isManager || !selectedSchedule) return;
    if (!targetWeekStart) {
      toast('Select a destination week start date.', { variant: 'warning' });
      return;
    }
    const laborBudget = Number(targetLaborBudget);
    setSubmittingScheduleModal(true);
    try {
      const created = await duplicateSchedule(selectedSchedule.id, {
        target_week_start: targetWeekStart,
        labor_budget: Number.isInteger(laborBudget) && laborBudget >= MIN_SCHEDULE_LABOR_BUDGET ? laborBudget : undefined,
      });
      await loadSchedules();
      setSelectedScheduleId(created.id);
      setIsScheduleModalOpen(false);
      toast(`Schedule duplicated to week of ${created.week_start}.`, { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to duplicate schedule.', { variant: 'error' });
    } finally {
      setSubmittingScheduleModal(false);
    }
  }

  async function handleGenerateFromModal() {
    if (!isManager) return;
    if (!targetWeekStart) {
      toast('Select a week start date.', { variant: 'warning' });
      return;
    }
    const laborBudget = Number(targetLaborBudget);
    if (!Number.isInteger(laborBudget) || laborBudget < MIN_SCHEDULE_LABOR_BUDGET) {
      toast(`Enter a whole-number labor budget of at least ${MIN_SCHEDULE_LABOR_BUDGET}.`, { variant: 'warning' });
      return;
    }
    setSubmittingScheduleModal(true);
    try {
      const created = await generateSchedule(targetWeekStart, laborBudget);
      await loadSchedules();
      setSelectedScheduleId(created.id);
      setIsScheduleModalOpen(false);
      toast(`New schedule generated for week of ${created.week_start}.`, { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to generate schedule.', { variant: 'error' });
    } finally {
      setSubmittingScheduleModal(false);
    }
  }

  async function handleCreateShift() {
    if (!isManager || !selectedScheduleId) return;
    if (!newShift.date || !newShift.start_time || !newShift.end_time || !newShift.role) {
      toast('Complete all shift fields before adding.', { variant: 'warning' });
      return;
    }
    if (newShift.end_time <= newShift.start_time) {
      toast('Shift end time must be after start time.', { variant: 'warning' });
      return;
    }
    setCreatingShift(true);
    try {
      if (newShift.employee_id) {
        await createShift({
          schedule_id: selectedScheduleId,
          employee_id: Number(newShift.employee_id),
          date: newShift.date,
          start_time: newShift.start_time,
          end_time: newShift.end_time,
          role: newShift.role,
        });
        await loadShifts(selectedScheduleId);
        toast('Shift added.', { variant: 'success' });
      } else {
        await createOpenShift({
          schedule_id: selectedScheduleId,
          date: newShift.date,
          start_time: newShift.start_time,
          end_time: newShift.end_time,
          role: newShift.role,
          reason: 'Unassigned shift',
        });
        await loadOpenShifts();
        toast('Open shift added.', { variant: 'success' });
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Rest window violation') && newShift.employee_id) {
        const confirmOverride = window.confirm(`${err.message}\n\nDo you want to override and schedule this shift anyway?`);
        if (confirmOverride) {
          try {
            await createShift({
              schedule_id: selectedScheduleId,
              employee_id: Number(newShift.employee_id),
              date: newShift.date,
              start_time: newShift.start_time,
              end_time: newShift.end_time,
              role: newShift.role,
              allow_override: true,
            });
            await loadShifts(selectedScheduleId);
            toast('Shift added with manager override.', { variant: 'warning' });
            return;
          } catch (overrideErr: any) {
            toast(overrideErr.message || 'Failed to add shift.', { variant: 'error' });
            return;
          }
        }
      }
      toast(err.message || 'Failed to add shift.', { variant: 'error' });
    } finally {
      setCreatingShift(false);
    }
  }

  async function handleCreateShiftFromDrag(date: string, employeeId: number) {
    if (!isManager || !selectedScheduleId) return;
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;
    if (!newShift.start_time || !newShift.end_time || newShift.end_time <= newShift.start_time) {
      toast('Set a valid start/end time before drag-and-drop scheduling.', { variant: 'warning' });
      return;
    }
    try {
      await createShift({
        schedule_id: selectedScheduleId,
        employee_id: employeeId,
        date,
        start_time: newShift.start_time,
        end_time: newShift.end_time,
        role: employee.role || newShift.role,
      });
      await loadShifts(selectedScheduleId);
      toast(`Shift created for ${employee.name}.`, { variant: 'success' });
    } catch (err: any) {
      if (err.message && err.message.includes('Rest window violation')) {
        const confirmOverride = window.confirm(`${err.message}\n\nDo you want to override and schedule this shift anyway?`);
        if (confirmOverride) {
          try {
            await createShift({
              schedule_id: selectedScheduleId,
              employee_id: employeeId,
              date,
              start_time: newShift.start_time,
              end_time: newShift.end_time,
              role: employee.role || newShift.role,
              allow_override: true,
            });
            await loadShifts(selectedScheduleId);
            toast(`Shift created for ${employee.name} with manager override.`, { variant: 'warning' });
            return;
          } catch (overrideErr: any) {
            toast(overrideErr.message || 'Failed to create shift by drag/drop.', { variant: 'error' });
            return;
          }
        }
      }
      toast(err.message || 'Failed to create shift by drag/drop.', { variant: 'error' });
    }
  }

  function startEditing(shift: ShiftWithEmployee) {
    setEditingShiftId(shift.id);
    setEditForm({
      employee_id: shift.employee_id ? String(shift.employee_id) : '',
      date: shift.date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      role: shift.role,
    });
  }

  async function saveShiftEdit() {
    if (!isManager || !selectedScheduleId || !editingShiftId) return;
    if (!editForm.employee_id || !editForm.date || !editForm.start_time || !editForm.end_time || !editForm.role) {
      toast('Complete all shift fields before saving.', { variant: 'warning' });
      return;
    }
    if (editForm.end_time <= editForm.start_time) {
      toast('Shift end time must be after start time.', { variant: 'warning' });
      return;
    }
    try {
      await updateShift(editingShiftId, {
        employee_id: Number(editForm.employee_id),
        date: editForm.date,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        role: editForm.role,
      });
      setEditingShiftId(null);
      await loadShifts(selectedScheduleId);
      toast('Shift updated.', { variant: 'success' });
    } catch (err: any) {
      if (err.message && err.message.includes('Rest window violation')) {
        const confirmOverride = window.confirm(`${err.message}\n\nDo you want to override and schedule this shift anyway?`);
        if (confirmOverride) {
          try {
            await updateShift(editingShiftId, {
              employee_id: Number(editForm.employee_id),
              date: editForm.date,
              start_time: editForm.start_time,
              end_time: editForm.end_time,
              role: editForm.role,
              allow_override: true,
            });
            setEditingShiftId(null);
            await loadShifts(selectedScheduleId);
            toast('Shift updated with manager override.', { variant: 'warning' });
            return;
          } catch (overrideErr: any) {
            toast(overrideErr.message || 'Failed to update shift.', { variant: 'error' });
            return;
          }
        }
      }
      toast(err.message || 'Failed to update shift.', { variant: 'error' });
    }
  }

  async function handleDeleteShift(shiftId: number) {
    if (!isManager || !selectedScheduleId) return;
    if (!confirm('Delete this shift?')) return;
    try {
      await deleteShift(shiftId);
      await loadShifts(selectedScheduleId);
      toast('Shift deleted.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to delete shift.', { variant: 'error' });
    }
  }

  async function handleDropShift(shift: ShiftWithEmployee) {
    if (!selectedScheduleId || !user?.employeeId || shift.employee_id !== user.employeeId) return;
    const reason = prompt('Why are you dropping this shift?');
    if (reason === null) return;
    setSubmittingShiftActionId(shift.id);
    try {
      await dropShift(shift.id, reason.trim() || 'No reason provided');
      setSwapDraftShiftId(null);
      await Promise.all([loadShifts(selectedScheduleId), loadOpenShifts()]);
      toast('Shift drop request submitted.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to drop shift.', { variant: 'error' });
    } finally {
      setSubmittingShiftActionId(null);
    }
  }

  async function handleOfferOpenShift(openShiftId: number) {
    setClaimingOpenShiftId(openShiftId);
    try {
      await offerForOpenShift(openShiftId);
      await loadOpenShifts();
      toast('Pickup request submitted.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Unable to pick up this shift.', { variant: 'error' });
    } finally {
      setClaimingOpenShiftId(null);
    }
  }

  function beginSwapRequest(shiftId: number) {
    setSwapDraftShiftId(shiftId);
    setSwapReason('');
    setSwapTargetId('');
  }

  async function handleRequestSwap(shift: ShiftWithEmployee) {
    if (!selectedScheduleId || !user?.employeeId || shift.employee_id !== user.employeeId) return;
    if (!swapTargetId) {
      toast('Choose a teammate to swap with.', { variant: 'warning' });
      return;
    }
    setSubmittingShiftActionId(shift.id);
    try {
      await createSwap({
        shift_id: shift.id,
        requester_id: user.employeeId,
        target_id: Number(swapTargetId),
        reason: swapReason.trim() || undefined,
      });
      setSwapDraftShiftId(null);
      setSwapReason('');
      setSwapTargetId('');
      toast('Swap request sent.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to request swap.', { variant: 'error' });
    } finally {
      setSubmittingShiftActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading schedule…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Schedule"
        subtitle={isManager ? 'Build and publish shifts fast' : 'See your next shift instantly'}
        color="#0D9488"
        icon="📅"
      />

      <Card className="space-y-3 border border-emerald-200/70 p-4 shadow-[0_10px_24px_rgba(13,148,136,0.08)]">
        {schedules.length === 0 ? (
          isManager ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No schedules yet. Generate your first schedule to get started.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <Input
                  label="Week Start"
                  type="date"
                  value={newScheduleWeekStart}
                  onChange={(e) => setNewScheduleWeekStart(e.target.value)}
                />
                <Input
                  label="Labor Budget ($)"
                  type="number"
                  min={MIN_SCHEDULE_LABOR_BUDGET}
                  step={1}
                  value={newScheduleLaborBudget}
                  onChange={(e) => setNewScheduleLaborBudget(e.target.value)}
                />
                <Button onClick={handleGenerateSchedule} isLoading={creatingSchedule}>
                  Generate First Schedule
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No schedules available yet.</p>
          )
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Active Schedule</label>
              <select
                className={NATIVE_SELECT_CLASS}
                value={selectedScheduleId ?? ''}
                onChange={(e) => setSelectedScheduleId(Number(e.target.value))}
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    Week of {s.week_start} ({s.status})
                  </option>
                ))}
              </select>
            </div>

            {isManager && selectedSchedule && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">View</label>
                  <div className="flex rounded-lg border border-border bg-muted/50 p-1">
                    <button
                      type="button"
                      className={`rounded-md px-2 py-1 text-xs font-medium transition ${managerScheduleView === 'weekly' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}
                      onClick={() => setManagerScheduleView('weekly')}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-2 py-1 text-xs font-medium transition ${managerScheduleView === 'daily' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}
                      onClick={() => setManagerScheduleView('daily')}
                    >
                      Daily
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Department Filter</label>
                  <select
                    className={NATIVE_SELECT_CLASS}
                    value={selectedDepartmentFilter}
                    onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
                  >
                    <option value="all">All departments</option>
                    {departmentOptions.map((department) => (
                      <option key={department} value={normalizedValue(department)}>
                        {department}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Employee Filter</label>
                  <select
                    className={NATIVE_SELECT_CLASS}
                    value={selectedEmployeeFilter}
                    onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                  >
                    <option value="all">All employees</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.name}</option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" onClick={handleTogglePublish}>
                  {selectedSchedule.status === 'published' ? 'Unpublish' : 'Publish'}
                </Button>
                <Button variant="default" onClick={openNewScheduleModal} className="flex items-center gap-1.5 shadow-sm">
                  <Plus className="h-4 w-4" />
                  New / Copy Week
                </Button>
                <Button variant="outline" onClick={() => window.print()} className="flex items-center gap-1.5" title="Print Schedule">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button variant="destructive" onClick={handleDeleteSchedule}>Delete Schedule</Button>
              </>
            )}

            {!isManager && (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant={employeeViewMode === 'weekly' ? 'default' : 'outline'}
                  onClick={() => setEmployeeViewMode('weekly')}
                >
                  Weekly
                </Button>
                <Button
                  size="sm"
                  variant={employeeViewMode === 'daily' ? 'default' : 'outline'}
                  onClick={() => setEmployeeViewMode('daily')}
                >
                  Daily
                </Button>
                {employeeViewMode === 'daily' && (
                  <Input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {isManager && selectedScheduleId && (
        <Card className="space-y-3 border border-emerald-200/70 p-4 shadow-[0_8px_20px_rgba(13,148,136,0.06)]">
          <h2 className="font-semibold text-foreground">Quick Shift Creation</h2>
          <p className="text-xs text-muted-foreground">Pick role/time once, then drag employees into the schedule grid.</p>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Input label="Date" type="date" value={newShift.date} onChange={(e) => setNewShift((prev) => ({ ...prev, date: e.target.value }))} />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Start</label>
              <select className={NATIVE_SELECT_CLASS} value={newShift.start_time} onChange={(e) => setNewShift((prev) => ({ ...prev, start_time: e.target.value }))}>
                {TIME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">End</label>
              <select className={NATIVE_SELECT_CLASS} value={newShift.end_time} onChange={(e) => setNewShift((prev) => ({ ...prev, end_time: e.target.value }))}>
                {TIME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select
                className={NATIVE_SELECT_CLASS}
                value={newShift.role}
                onChange={(e) => setNewShift((prev) => ({ ...prev, role: e.target.value }))}
              >
                {roleOptions.map((role) => <option key={role}>{role}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="new-shift-employee" className="text-xs font-medium text-muted-foreground">Assign Employee (optional)</label>
              <select
                id="new-shift-employee"
                className={NATIVE_SELECT_CLASS}
                value={newShift.employee_id}
                onChange={(e) => setNewShift((prev) => ({ ...prev, employee_id: e.target.value }))}
              >
                <option value="">leave unassigned (open shift)</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={handleCreateShift} isLoading={creatingShift}>
            {newShift.employee_id ? 'Add Shift' : 'Add Open Shift'}
          </Button>

          <div className="pt-2 border-t border-border space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Employee Roster (drag into a day)</h3>
            <div className="flex flex-wrap gap-2">
              {employees.map((employee) => {
                const employeeDepartment = employeeDepartmentLabel(employee);
                return (
                <button
                  key={employee.id}
                  type="button"
                  draggable
                  aria-label={`Create shift for ${employee.name}`}
                  onDragStart={() => setDraggedEmployeeId(employee.id)}
                  onDragEnd={() => {
                    setDraggedEmployeeId(null);
                    setDropDate(null);
                  }}
                  className={`rounded-md border px-2 py-1 text-left text-xs ${departmentTone(employeeDepartment)}`}
                  title={`Drag to create a shift for ${employee.name}`}
                >
                  <div className="font-medium text-foreground">{employee.name}</div>
                  <div className="text-muted-foreground">{employee.role}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{employeeDepartment}</div>
                </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {isManager && editingShiftId && (
        <Card className="space-y-3 border border-emerald-200/70 p-4">
          <h2 className="font-semibold text-foreground">Edit Shift</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input label="Date" type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Start</label>
              <select className={NATIVE_SELECT_CLASS} value={editForm.start_time} onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))}>
                {TIME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">End</label>
              <select className={NATIVE_SELECT_CLASS} value={editForm.end_time} onChange={(e) => setEditForm((p) => ({ ...p, end_time: e.target.value }))}>
                {TIME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Employee</label>
              <select className={NATIVE_SELECT_CLASS} value={editForm.employee_id} onChange={(e) => setEditForm((p) => ({ ...p, employee_id: e.target.value }))}>
                <option value="" disabled hidden>Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select className={NATIVE_SELECT_CLASS} value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
                {roleOptions.map((role) => <option key={role}>{role}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveShiftEdit}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setEditingShiftId(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card className="space-y-4 rounded-[22px] border border-emerald-200/70 bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.07)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Week of {weekMetadata.label}</h2>
            <p className="text-xs text-muted-foreground">Clean schedule view with role color-coding and emphasized start times</p>
          </div>
          {!isManager && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" />
              Use <strong>Drop Shift</strong> or <strong>Swap Shift</strong> directly from your shifts
            </div>
          )}
        </div>

        {isManager && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">Legend:</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500 bg-yellow-300 px-2 py-0.5 font-semibold text-yellow-950">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
              Short Staffed Day
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-red-600 bg-red-300 px-2 py-0.5 font-semibold text-red-900">
              <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
              Over Staffed Day
            </span>
          </div>
        )}

        {isManager && managerSelectedEmployeeSummary && (
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-2">
            <div className="text-sm font-semibold text-foreground">{managerSelectedEmployeeSummary.name}</div>
            <div className="text-xs text-muted-foreground">{managerSelectedEmployeeSummary.scheduledHoursLabel}</div>
            {managerSelectedEmployeeSummary.approvedTimeOffLabels.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {managerSelectedEmployeeSummary.approvedTimeOffLabels.map((label) => (
                  <span key={label} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                    {label}
                  </span>
                ))}
              </div>
            )}
            {managerSelectedEmployeeSummary.unavailableLabels.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {managerSelectedEmployeeSummary.unavailableLabels.map((label) => (
                  <span key={label} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {isManager && (weeklyStaffingSignal.understaffedDays > 0 || weeklyStaffingSignal.overstaffedDays > 0) && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-slate-50 px-3 py-2 text-xs">
            <span className="font-semibold text-foreground">Week Staffing Signal:</span>
            {weeklyStaffingSignal.understaffedDays > 0 && (
              <span className="rounded-full border border-yellow-500 bg-yellow-300 px-2 py-0.5 font-semibold text-yellow-900">
                {weeklyStaffingSignal.understaffedDays} understaffed day{weeklyStaffingSignal.understaffedDays !== 1 ? 's' : ''}
              </span>
            )}
            {weeklyStaffingSignal.overstaffedDays > 0 && (
              <span className="rounded-full border border-red-600 bg-red-300 px-2 py-0.5 font-semibold text-red-900">
                {weeklyStaffingSignal.overstaffedDays} overstaffed day{weeklyStaffingSignal.overstaffedDays !== 1 ? 's' : ''}
              </span>
            )}
            {weeklyRoleContributors.under.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-medium text-yellow-900">Short by:</span>
                {weeklyRoleContributors.under.slice(0, 4).map((entry) => (
                  <span key={`under-${entry.role}`} className="rounded-full border border-yellow-600 bg-yellow-300 px-1.5 py-0.5 font-semibold text-yellow-950">
                    {entry.role} {entry.delta}
                  </span>
                ))}
              </div>
            )}
            {weeklyRoleContributors.over.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-medium text-red-900">Over by:</span>
                {weeklyRoleContributors.over.slice(0, 4).map((entry) => (
                  <span key={`over-${entry.role}`} className="rounded-full border border-red-700 bg-red-300 px-1.5 py-0.5 font-semibold text-red-950">
                    {entry.role} +{entry.delta}
                  </span>
                ))}
              </div>
            )}
            <span className="text-muted-foreground">Based on expected demand from prior sales patterns.</span>
          </div>
        )}

        {isManager && staffingRecommendations.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Recommended Assignments</h3>
                <p className="text-xs text-muted-foreground">Best-fit employees for the top staffing needs by day</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <span>Day</span>
                <select
                  className={NATIVE_SELECT_CLASS + ' min-w-[140px]'}
                  value={selectedRecommendationDay}
                  onChange={(event) => setSelectedRecommendationDay(event.target.value)}
                  aria-label="Select recommendation day"
                >
                  {staffingRecommendations.map((day) => (
                    <option key={day.date} value={day.date}>{day.date}</option>
                  ))}
                </select>
              </div>
            </div>

            {(() => {
              const selectedDayRecommendation = staffingRecommendations.find((day) => day.date === selectedRecommendationDay) ?? staffingRecommendations[0];
              if (!selectedDayRecommendation) return null;

              return (
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{selectedDayRecommendation.date}</div>
                      <div className="text-xs text-muted-foreground">{selectedDayRecommendation.expected_revenue > 0 ? `$${selectedDayRecommendation.expected_revenue.toLocaleString()} expected revenue` : 'Demand-based staffing'}</div>
                    </div>
                    {selectedDayRecommendation.staffing_status && selectedDayRecommendation.staffing_status !== 'adequate' && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${selectedDayRecommendation.staffing_status === 'understaffed' ? 'bg-yellow-500 text-yellow-950' : 'bg-red-600 text-red-50'}`}>
                        {selectedDayRecommendation.staffing_status === 'understaffed' ? 'Short' : 'Over'}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {selectedDayRecommendation.recommendedNeeds.map((need) => {
                      const accent = getRoleAccent(need.role);
                      return (
                        <div key={`${selectedDayRecommendation.date}-${need.role}-${need.start}-${need.end}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className={`truncate text-sm font-semibold ${accent.text}`}>{need.roleLabel}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {need.start} - {need.end} · need {need.count}
                              </div>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${accent.chip}`}>
                              Shift fit
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {need.candidates.length > 0 ? need.candidates.map((candidate: CandidateRecommendation) => (
                              <span
                                key={`${selectedDayRecommendation.date}-${need.role}-${candidate.employee.id}`}
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${candidate.score >= 70 ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : candidate.score >= 35 ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-slate-300 bg-slate-100 text-slate-700'}`}
                                title={candidate.reasons.join(', ')}
                              >
                                {candidate.employee.name}
                              </span>
                            )) : (
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-muted-foreground">
                                No strong fit found
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedDayRecommendation.extraNeeds > 0 && (
                    <div className="mt-2 text-[11px] text-muted-foreground">+{selectedDayRecommendation.extraNeeds} more position{selectedDayRecommendation.extraNeeds > 1 ? 's' : ''} available in the full demand list.</div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <div className="overflow-x-auto pb-1" data-testid="schedule-week-scroll">
          <div
            className="space-y-2"
            style={{
              minWidth: scheduleDays.length > 1 ? `${scheduleDays.length * WEEK_DAY_COLUMN_MIN_WIDTH + 32}px` : undefined,
            }}
          >
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${scheduleDays.length}, minmax(${WEEK_DAY_COLUMN_MIN_WIDTH}px, 1fr))`,
              }}
            >
              {scheduleDays.map((day) => (
                <div
                  key={day.date}
                  data-testid="schedule-day-column"
                  className="min-w-55"
                >
                  <div className={`sticky top-0 z-10 mb-2 rounded-xl bg-muted/70 text-center font-semibold uppercase tracking-wide text-muted-foreground ${isCompactWeeklyManagerView ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-2 text-[11px]'}`}>
                    {day.weekday}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${scheduleDays.length}, minmax(${WEEK_DAY_COLUMN_MIN_WIDTH}px, 1fr))`,
              }}
            >
              {scheduleDays.map((day) => {
                const dayShifts = shiftsByDate.get(day.date) ?? [];
                const dayOpenShifts = openShiftsByDate.get(day.date) ?? [];
                const isDropActive = isManager && dropDate === day.date;
                const staffingSignal = staffingStatusByDate.get(day.date);
                const staffingClass = staffingSignal?.status === 'understaffed'
                  ? 'border-yellow-500 bg-yellow-300/95'
                  : staffingSignal?.status === 'overstaffed'
                    ? 'border-red-600 bg-red-300/95'
                    : 'border-border';
                return (
                  <div
                    key={day.date}
                    data-testid="schedule-day-column"
                    className={`min-h-52.5 min-w-55 rounded-2xl border ${isCompactWeeklyManagerView ? 'space-y-1.5 p-1.5' : 'space-y-2 p-2.5'} ${isDropActive ? 'border-primary border-2 bg-card' : staffingClass}`}
                    onDragOver={(e) => {
                      if (!isManager || draggedEmployeeId === null) return;
                      e.preventDefault();
                      setDropDate(day.date);
                    }}
                    onDragLeave={() => {
                      if (dropDate === day.date) setDropDate(null);
                    }}
                    onDrop={async (e) => {
                      if (!isManager || draggedEmployeeId === null) return;
                      e.preventDefault();
                      setDropDate(null);
                      await handleCreateShiftFromDrag(day.date, draggedEmployeeId);
                      setDraggedEmployeeId(null);
                    }}
                  >
                    <div className={`sticky top-0 z-10 rounded-lg bg-white/90 font-semibold text-foreground backdrop-blur-sm ${isCompactWeeklyManagerView ? 'px-1 py-0.5 text-[10px]' : 'px-1 py-1 text-xs'}`}>
                      <div className="flex items-center justify-between gap-1">
                        <span>{day.dayLabel}</span>
                        {staffingSignal && staffingSignal.status !== 'adequate' && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${staffingSignal.status === 'understaffed' ? 'bg-yellow-500 text-yellow-950' : 'bg-red-600 text-red-50'}`}>
                            {staffingSignal.status === 'understaffed' ? 'Short' : 'Over'}
                          </span>
                        )}
                      </div>
                      {staffingSignal && staffingSignal.status !== 'adequate' && staffingSignal.roleDeltas.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {staffingSignal.roleDeltas
                            .filter((entry) => staffingSignal.status === 'understaffed' ? entry.delta < 0 : entry.delta > 0)
                            .map((entry) => (
                              <span
                                key={`${day.date}-${entry.role}`}
                                title={`${entry.role}: scheduled ${entry.actual}, suggested ${entry.suggested}`}
                                className={`rounded-full border px-1 py-0.5 text-[9px] font-semibold ${staffingSignal.status === 'understaffed' ? 'border-yellow-600 bg-yellow-400 text-yellow-950' : 'border-red-700 bg-red-500 text-red-50'}`}
                              >
                                {entry.role} {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    {sortDepartmentGroups(
                      Array.from(
                        dayShifts.reduce((groups, shift) => {
                          const department = getDepartmentGroupLabel(getShiftDisplayGroup(shift));
                          const bucket = groups.get(department) || [];
                          bucket.push(shift);
                          groups.set(department, bucket);
                          return groups;
                        }, new Map<string, ShiftWithEmployee[]>())
                      ).map(([department, items]) => ({ department, items }))
                    ).map(({ department, items }) => (
                      <div key={`${day.date}-${department}`} className="space-y-1.5">
                        <div className="flex items-center justify-between rounded-md border border-border bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                          <span>{department}</span>
                          <span>{items.length}</span>
                        </div>
                        {items.map((shift) => {
                          const isOwnShift = !!user?.employeeId && shift.employee_id === user.employeeId;
                          const isSwapDraftOpen = swapDraftShiftId === shift.id;
                          const departmentLabel = getShiftDisplayGroup(shift);
                          const employeeName = shift.employee_name || 'Unassigned';
                          return (
<div key={shift.id} className={`shift-block overflow-hidden rounded-xl border border-slate-200 border-l-4 bg-white shadow-sm ${isCompactWeeklyManagerView ? 'p-1.5' : 'p-2.5'} ${getRoleAccent(shift.role).border}`}>
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className={`truncate ${isCompactWeeklyManagerView ? 'text-[11px]' : 'text-sm'} font-semibold ${getRoleAccent(shift.role).text}`}>{formatRoleLabel(shift.role)}</div>
                              <div className={`mt-0.5 flex min-w-0 items-baseline gap-1 ${isCompactWeeklyManagerView ? 'text-[10px]' : 'text-xs'} text-slate-700`}>
                                <span className="shrink-0 font-bold">{formatTime12(shift.start_time)}</span>
                                <span className="truncate text-slate-500">- {formatTime12(shift.end_time)}</span>
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full border border-current/15 bg-white/80 px-1.5 py-0.5 ${isCompactWeeklyManagerView ? 'text-[8px]' : 'text-[9px]'} font-medium uppercase tracking-wide ${getRoleAccent(shift.role).text}`}>
                              {departmentLabel}
                            </span>
                          </div>

                          <div className={`mt-1.5 truncate ${isCompactWeeklyManagerView ? 'text-[10px]' : 'text-[11px]'} ${getRoleAccent(shift.role).text}`}>{employeeName}</div>

                              {overlappingShiftIds.has(shift.id) && (
                                <div
                                  className="mt-1.5 flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 border border-red-200"
                                  title="Time Conflict: This employee is scheduled for overlapping shifts at the same time"
                                >
                                  <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
                                  <span>Time Conflict (Overlapping)</span>
                                </div>
                              )}

                              {quickReturnShiftMap.has(shift.id) && (
                                <div
                                  className="mt-1.5 flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200"
                                  title={`Quick return / Clopening: only ${quickReturnShiftMap.get(shift.id)?.restHours}h rest after ${quickReturnShiftMap.get(shift.id)?.prevShiftSummary}`}
                                >
                                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                                  <span>{quickReturnShiftMap.get(shift.id)?.restHours}h rest (clopen)</span>
                                </div>
                              )}

                              {isManager && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    type="button"
                                    aria-label={`Edit shift for ${employeeName}`}
                                    title={`Edit shift for ${employeeName}`}
                                    onClick={() => startEditing(shift)}
                                    className="h-7 w-7"
                                  >
                                    <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="destructive"
                                    type="button"
                                    aria-label={`Delete shift for ${employeeName}`}
                                    title={`Delete shift for ${employeeName}`}
                                    onClick={() => handleDeleteShift(shift.id)}
                                    className="h-7 w-7"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                </div>
                              )}

                              {!isManager && isOwnShift && (
                                <div className="space-y-2 pt-1">
                                  <div className="flex flex-wrap gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDropShift(shift)}
                                      isLoading={submittingShiftActionId === shift.id}
                                      aria-label={`Drop shift for ${employeeName}`}
                                    >
                                      Drop
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => beginSwapRequest(shift.id)}
                                      aria-label={`Swap shift for ${employeeName}`}
                                    >
                                      Swap
                                    </Button>
                                  </div>
                                  {isSwapDraftOpen && (
                                    <div className="space-y-1.5 rounded-md border border-border bg-white/80 p-2">
                                      <select
                                        className={NATIVE_SELECT_CLASS}
                                        value={swapTargetId}
                                        onChange={(e) => setSwapTargetId(e.target.value)}
                                        aria-label={`Choose teammate for ${employeeName} swap`}
                                      >
                                        <option value="" disabled hidden>Select teammate</option>
                                        {employees
                                          .filter((e) => e.id !== user?.employeeId)
                                          .map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                                      </select>
                                      <input
                                        className={EDIT_INPUT_CLASS}
                                        placeholder="Reason (optional)"
                                        aria-label={`Reason for ${employeeName} shift swap`}
                                        value={swapReason}
                                        onChange={(e) => setSwapReason(e.target.value)}
                                      />
                                      <div className="flex gap-1.5">
                                        <Button
                                          size="sm"
                                          onClick={() => handleRequestSwap(shift)}
                                          isLoading={submittingShiftActionId === shift.id}
                                        >
                                          Send Swap
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setSwapDraftShiftId(null)}>Cancel</Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    {dayOpenShifts.map((openShift) => (
                      <div key={`open-${openShift.id}`} className={`overflow-hidden rounded-xl border border-slate-200 border-l-4 bg-white shadow-sm ${isCompactWeeklyManagerView ? 'p-1.5' : 'p-2.5'} ${getRoleAccent(openShift.role).border}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`truncate ${isCompactWeeklyManagerView ? 'text-[11px]' : 'text-sm'} font-semibold ${getRoleAccent(openShift.role).text}`}>{formatRoleLabel(openShift.role)}</div>
                            <div className={`mt-0.5 flex min-w-0 items-baseline gap-1 ${isCompactWeeklyManagerView ? 'text-[10px]' : 'text-xs'} text-slate-700`}>
                              <span className="shrink-0 font-bold">{formatTime12(openShift.start_time)}</span>
                              <span className="truncate text-slate-500">- {formatTime12(openShift.end_time)}</span>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full border border-current/15 bg-white/80 px-1.5 py-0.5 ${isCompactWeeklyManagerView ? 'text-[8px]' : 'text-[9px]'} font-medium uppercase tracking-wide ${getRoleAccent(openShift.role).text}`}>
                            Open
                          </span>
                        </div>
                        {!isManager && (
                          <Button
                            size="sm"
                            onClick={() => handleOfferOpenShift(openShift.id)}
                            isLoading={claimingOpenShiftId === openShift.id}
                            className="mt-2 w-full"
                            aria-label={`Pickup open shift for ${openShift.role}`}
                          >
                            Pickup
                          </Button>
                        )}
                      </div>
                    ))}

                    {dayShifts.length === 0 && dayOpenShifts.length === 0 && (
                      <div className={`text-muted-foreground ${isCompactWeeklyManagerView ? 'pt-1 text-[10px]' : 'pt-2 text-[11px]'}`}>No shifts</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Modal
        open={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Create or Copy Schedule Week"
      >
        <div className="space-y-4 pt-1">
          <div className="flex rounded-lg border border-border bg-muted/50 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                scheduleModalTab === 'copy'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setScheduleModalTab('copy')}
            >
              <span className="inline-flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Duplicate Active Week
              </span>
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                scheduleModalTab === 'generate'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setScheduleModalTab('generate')}
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Auto-Generate with AI
              </span>
            </button>
          </div>

          {scheduleModalTab === 'copy' ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Copy all shifts from the week of <strong className="text-foreground">{selectedSchedule?.week_start}</strong> to a new destination week. Shifts will be shifted by the exact day offset.
              </p>
              <Input
                label="Destination Week Start (Monday)"
                type="date"
                value={targetWeekStart}
                onChange={(e) => setTargetWeekStart(e.target.value)}
              />
              <Input
                label="Labor Budget ($)"
                type="number"
                min={MIN_SCHEDULE_LABOR_BUDGET}
                value={targetLaborBudget}
                onChange={(e) => setTargetLaborBudget(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsScheduleModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleDuplicateSchedule} isLoading={submittingScheduleModal}>
                  Duplicate Week
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Run the automated scheduler engine to generate optimal shifts according to staff availability and labor budget.
              </p>
              <Input
                label="Week Start (Monday)"
                type="date"
                value={targetWeekStart}
                onChange={(e) => setTargetWeekStart(e.target.value)}
              />
              <Input
                label="Labor Budget ($)"
                type="number"
                min={MIN_SCHEDULE_LABOR_BUDGET}
                value={targetLaborBudget}
                onChange={(e) => setTargetLaborBudget(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsScheduleModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateFromModal} isLoading={submittingScheduleModal}>
                  Generate Schedule
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
