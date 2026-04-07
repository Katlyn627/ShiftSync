import { useEffect, useState, CSSProperties, useCallback } from 'react';
import {
  getSchedules, generateSchedule, getScheduleShifts, updateSchedule, deleteSchedule,
  getEmployees, createSwap, updateShift, createShift, deleteShift, dropShift, getBurnoutRisks, getAvailability,
  getScheduleCoverage, getScheduleIntelligence, getGeneratePreview, getPosIntegrations,
  createPosIntegration, deletePosIntegration, syncPosIntegration,
  Schedule, ShiftWithEmployee, Employee, BurnoutRisk, Availability, ScheduleCoverageReport,
  DayIntelligence, ScheduleIntelligence, GeneratePreview, PosIntegration,
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Input, Card, Badge, NATIVE_SELECT_CLASS, PageHeader, useToast } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHIFT_SLOTS = [
  { key: 'morning', label: 'Morning', min: 0, max: 12 * 60 },
  { key: 'mid', label: 'Mid', min: 12 * 60, max: 16 * 60 },
  { key: 'evening', label: 'Evening', min: 16 * 60, max: 20 * 60 },
  { key: 'close', label: 'Close', min: 20 * 60, max: 24 * 60 },
] as const;
type ShiftSlotKey = (typeof SHIFT_SLOTS)[number]['key'];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h * 60) + m;
}

function shiftSlot(startTime: string): ShiftSlotKey {
  const mins = toMinutes(startTime);
  return SHIFT_SLOTS.find(slot => mins >= slot.min && mins < slot.max)?.key ?? 'close';
}

function shiftHours(start: string, end: string): number {
  return (toMinutes(end) - toMinutes(start)) / 60;
}

function roleVariant(role: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    Manager: 'manager',
    Server:  'server',
    Kitchen: 'kitchen',
    Bar:     'bar',
    Host:    'host',
  };
  return map[role] ?? 'default';
}

/** Role colour palette — left-bar accent + soft card background */
const ROLE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  manager: { bg: '#f5f3ff', text: '#5b21b6', bar: '#7c3aed' },
  server:  { bg: '#eff6ff', text: '#1d4ed8', bar: '#3b82f6' },
  kitchen: { bg: '#fff7ed', text: '#c2410c', bar: '#f97316' },
  bar:     { bg: '#f0fdf4', text: '#15803d', bar: '#22c55e' },
  host:    { bg: '#fdf2f8', text: '#9d174d', bar: '#ec4899' },
};

function shiftBlockStyle(role: string): CSSProperties {
  const c = ROLE_COLORS[role.toLowerCase()] ?? { bg: '#f8fafc', text: '#475569', bar: '#94a3b8' };
  return { backgroundColor: c.bg, color: c.text };
}

function shiftBarColor(role: string): string {
  return (ROLE_COLORS[role.toLowerCase()] ?? { bar: '#94a3b8' }).bar;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.isManager ?? false;
  const [schedules, setSchedules]     = useState<Schedule[]>([]);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [shifts, setShifts]           = useState<ShiftWithEmployee[]>([]);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [weekStart, setWeekStart]     = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  });
  const [budget, setBudget] = useState(5000);

  const [swapShift, setSwapShift]           = useState<ShiftWithEmployee | null>(null);
  const [employees, setEmployees]           = useState<Employee[]>([]);
  const [swapReason, setSwapReason]         = useState('');
  const [swapTargetId, setSwapTargetId]     = useState('');
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [burnoutRisks, setBurnoutRisks]     = useState<BurnoutRisk[]>([]);
  const [coverage, setCoverage]             = useState<ScheduleCoverageReport | null>(null);
  const [intelligence, setIntelligence]     = useState<ScheduleIntelligence | null>(null);
  const [availabilityByEmployee, setAvailabilityByEmployee] = useState<Record<number, Availability[]>>({});
  const [dropLoadingShiftId, setDropLoadingShiftId] = useState<number | null>(null);

  // ── Drop shift modal state ────────────────────────────────────────────────
  const [dropShiftTarget, setDropShiftTarget]     = useState<ShiftWithEmployee | null>(null);
  const [dropReasonCategory, setDropReasonCategory] = useState('');
  const [dropReasonNote, setDropReasonNote]         = useState('');
  const [dropSubmitting, setDropSubmitting]         = useState(false);

  // ── Schedule view filter ──────────────────────────────────────────────────
  type ViewFilter = 'all' | 'my_shifts' | 'my_department';
  const [viewFilter, setViewFilter]             = useState<ViewFilter>('all');

  // ── Data preview (forecast + profitability metrics for selected week) ──────
  const [weekPreview, setWeekPreview]       = useState<GeneratePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── POS Integrations ──────────────────────────────────────────────────────
  const [posIntegrations, setPosIntegrations]         = useState<PosIntegration[]>([]);
  const [showPosPanel, setShowPosPanel]               = useState(false);
  const [addingPosForm, setAddingPosForm]             = useState({ platform_name: 'square', display_name: '', api_key: '' });
  const [posAddLoading, setPosAddLoading]             = useState(false);
  const [posSyncingId, setPosSyncingId]               = useState<number | null>(null);
  const [posSyncMsg, setPosSyncMsg]                   = useState<string | null>(null);

  const POS_PLATFORMS = [
    { value: 'square',     label: 'Square' },
    { value: 'toast',      label: 'Toast' },
    { value: 'clover',     label: 'Clover' },
    { value: 'lightspeed', label: 'Lightspeed' },
    { value: 'revel',      label: 'Revel Systems' },
    { value: 'other',      label: 'Other' },
  ];

  // ── Manager filter state ──────────────────────────────────────────────────
  type ActiveFilter = 'understaffed' | 'overstaffed' | 'burnout' | 'budget_flexible' | null;
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);

  // Manual shift creation modal state
  const [addShiftCell, setAddShiftCell] = useState<{ date: string; slotKey: string } | null>(null);
  const [addShiftForm, setAddShiftForm] = useState({
    employee_id: '',
    start_time: '09:00',
    end_time: '17:00',
    role: 'Server',
  });
  const [addShiftSubmitting, setAddShiftSubmitting] = useState(false);

  const ROLES = ['Server', 'Kitchen', 'Bar', 'Host', 'Manager'];

  const load = async () => {
    try {
      const s = await getSchedules();
      setSchedules(s);
      if (s.length > 0 && !selectedId) setSelectedId(s[0].id);
    } finally {
      setLoading(false);
    }
  };

  // Load POS integrations once when manager opens the page
  useEffect(() => {
    if (isManager) {
      getPosIntegrations().then(setPosIntegrations).catch(() => {});
    }
  }, [isManager]);

  // Fetch the generate preview whenever the manager changes the week
  useEffect(() => {
    if (!isManager || !weekStart) return;
    setPreviewLoading(true);
    getGeneratePreview(weekStart)
      .then(data => setWeekPreview(data))
      .catch(() => setWeekPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [weekStart, isManager]);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    getEmployees().then(async data => {
      setEmployees(data);
      const entries = await Promise.all(
        data.map(async employee => [employee.id, await getAvailability(employee.id).catch(() => [])] as const)
      );
      setAvailabilityByEmployee(Object.fromEntries(entries));
    }).catch(err => console.error('Failed to load employees:', err));
  }, []);

  const refreshShifts = useCallback((id: number) => {
    getScheduleShifts(id).then(setShifts).catch(() => setShifts([]));
    getScheduleCoverage(id).then(setCoverage).catch(() => setCoverage(null));
    if (isManager) {
      getScheduleIntelligence(id).then(setIntelligence).catch(() => setIntelligence(null));
    }
  }, [isManager]);

  useEffect(() => {
    if (!selectedId) return;
    refreshShifts(selectedId);
    getBurnoutRisks(selectedId).then(setBurnoutRisks).catch(() => setBurnoutRisks([]));
  }, [selectedId, refreshShifts]);

  // Re-fetch shifts every 30 seconds so approved swaps/drops appear automatically
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => { refreshShifts(selectedId); }, 30000);
    return () => clearInterval(interval);
  }, [selectedId, refreshShifts]);

  // Re-fetch shifts when the tab becomes visible again (e.g. after approving on another page)
  useEffect(() => {
    if (!selectedId) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshShifts(selectedId);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [selectedId, refreshShifts]);

  // ── POS integration handlers ──────────────────────────────────────────────
  const handleAddPosIntegration = async () => {
    if (!addingPosForm.platform_name) return;
    setPosAddLoading(true);
    try {
      const integration = await createPosIntegration({
        platform_name: addingPosForm.platform_name,
        display_name: addingPosForm.display_name || undefined,
        api_key: addingPosForm.api_key || undefined,
      });
      setPosIntegrations(prev => [integration, ...prev]);
      setAddingPosForm({ platform_name: 'square', display_name: '', api_key: '' });
      toast(`${integration.display_name} connected successfully.`, { variant: 'success' });
    } catch (err: any) {
      toast('Error adding integration: ' + err.message, { variant: 'error' });
    } finally {
      setPosAddLoading(false);
    }
  };

  const handleDeletePosIntegration = async (id: number) => {
    if (!confirm('Remove this POS integration?')) return;
    try {
      await deletePosIntegration(id);
      setPosIntegrations(prev => prev.filter(p => p.id !== id));
      toast('POS integration removed.', { variant: 'default' });
    } catch (err: any) {
      toast('Error removing integration: ' + err.message, { variant: 'error' });
    }
  };

  const handleSyncPos = async (id: number) => {
    setPosSyncingId(id);
    setPosSyncMsg(null);
    try {
      const result = await syncPosIntegration(id);
      setPosIntegrations(prev => prev.map(p => p.id === id ? result.integration : p));
      const baseMsg = `POS synced — $${result.total_revenue_synced.toLocaleString()} revenue imported across ${result.synced_dates} days`;
      const seasonalNote = result.seasonal_events_applied && result.seasonal_events_applied.length > 0
        ? ` · Events: ${result.seasonal_events_applied.join(', ')}`
        : '';
      const msg = baseMsg + seasonalNote;
      setPosSyncMsg(msg);
      toast(msg, { variant: 'success', duration: 6000 });
      // Refresh the week preview after POS sync updates forecasts
      const preview = await getGeneratePreview(weekStart).catch(() => null);
      if (preview) setWeekPreview(preview);
    } catch (err: any) {
      toast('POS sync failed: ' + err.message, { variant: 'error' });
    } finally {
      setPosSyncingId(null);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const s = await generateSchedule(weekStart, budget);
      await load();
      setSelectedId(s.id);
      toast('Schedule generated successfully.', { variant: 'success' });
    } catch (err: any) {
      toast('Error generating schedule: ' + err.message, { variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedId) return;
    const s = schedules.find(sc => sc.id === selectedId);
    if (!s) return;
    const newStatus = s.status === 'published' ? 'draft' : 'published';
    try {
      await updateSchedule(selectedId, { status: newStatus });
      await load();
      toast(`Schedule ${newStatus === 'published' ? 'published' : 'set back to draft'}.`, { variant: 'success' });
    } catch (err: any) {
      toast('Error updating schedule: ' + err.message, { variant: 'error' });
    }
  };

  const handleDeleteSchedule = async () => {
    if (!selectedId || !isManager) return;
    if (!confirm('Delete this schedule and all its shifts? This cannot be undone.')) return;
    try {
      await deleteSchedule(selectedId);
      const remaining = schedules.filter(s => s.id !== selectedId);
      setSchedules(remaining);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      setShifts([]);
      toast('Schedule deleted.', { variant: 'default' });
    } catch (err: any) {
      toast('Error deleting schedule: ' + err.message, { variant: 'error' });
    }
  };

  const handleOpenSwap = (shift: ShiftWithEmployee) => {
    setSwapShift(shift);
    setSwapReason('');
    setSwapTargetId('');
  };

  const handleOpenDrop = (shift: ShiftWithEmployee) => {
    setDropShiftTarget(shift);
    setDropReasonCategory('');
    setDropReasonNote('');
  };

  const handleSubmitDrop = async () => {
    if (!dropShiftTarget) return;
    if (!dropReasonCategory) {
      toast('Please select a reason for dropping the shift.', { variant: 'warning' });
      return;
    }
    const fullReason = dropReasonNote.trim()
      ? `${dropReasonCategory}: ${dropReasonNote.trim()}`
      : dropReasonCategory;
    setDropSubmitting(true);
    try {
      const result = await dropShift(dropShiftTarget.id, fullReason);
      setDropShiftTarget(null);
      if (result.is_last_minute) {
        toast(
          `Drop request submitted. ⚠️ Last-minute (${result.hours_until_shift}h away) — coworkers and your manager have been notified.`,
          { variant: 'warning', duration: 6000 },
        );
      } else {
        toast('Drop request submitted. Your manager will review it and your coworkers have been notified of the opportunity to pick up the shift.', { variant: 'success', duration: 5000 });
      }
      const refreshed = await getScheduleShifts(selectedId!);
      setShifts(refreshed);
    } catch (err: any) {
      toast('Error submitting drop request: ' + err.message, { variant: 'error' });
    } finally {
      setDropSubmitting(false);
    }
  };

  const handleSubmitSwap = async () => {
    if (!swapShift || !user?.employeeId) return;
    setSwapSubmitting(true);
    try {
      await createSwap({
        shift_id:     swapShift.id,
        requester_id: user.employeeId,
        target_id:    swapTargetId ? Number(swapTargetId) : undefined,
        reason:       swapReason || undefined,
      });
      setSwapShift(null);
      toast('Swap request submitted! A manager will review it shortly.', { variant: 'success' });
    } catch (err: any) {
      toast('Error submitting swap: ' + err.message, { variant: 'error' });
    } finally {
      setSwapSubmitting(false);
    }
  };

  const selectedSchedule = schedules.find(s => s.id === selectedId);

  // Current employee record (used for department filter)
  const currentEmployee = employees.find(e => e.id === user?.employeeId);

  // Apply the view filter before building the calendar grid
  const visibleShifts = shifts.filter(shift => {
    if (viewFilter === 'my_shifts') return shift.employee_id === user?.employeeId;
    if (viewFilter === 'my_department' && currentEmployee?.department) {
      // Find the employee record for this shift to check their department
      const emp = employees.find(e => e.id === shift.employee_id);
      return emp?.department === currentEmployee.department;
    }
    return true;
  });

  const shiftsByDateAndSlot: Record<string, Record<ShiftSlotKey, ShiftWithEmployee[]>> = {};
  const employeeHours: Record<number, number> = {};
  for (const shift of shifts) {
    // employeeHours tracks ALL shifts (unfiltered) for hours display accuracy
    employeeHours[shift.employee_id] = (employeeHours[shift.employee_id] ?? 0) + shiftHours(shift.start_time, shift.end_time);
  }
  for (const shift of visibleShifts) {
    shiftsByDateAndSlot[shift.date] ??= { morning: [], mid: [], evening: [], close: [] };
    shiftsByDateAndSlot[shift.date][shiftSlot(shift.start_time)].push(shift);
  }

  const burnoutByEmployee = Object.fromEntries(burnoutRisks.map(risk => [risk.employee_id, risk]));

  // Build quick intelligence lookup by date
  const intelByDate: Record<string, DayIntelligence> = {};
  if (intelligence) {
    for (const day of intelligence.days) intelByDate[day.date] = day;
  }

  // Determine if a given employee should be highlighted by the burnout filter
  const isBurnoutHighlightedEmployee = (empId: number) =>
    activeFilter === 'burnout' && burnoutByEmployee[empId]?.risk_level === 'high';

  // Determine day column overlay class and label for the active filter
  const getDayFilterOverlay = (date: string) => {
    if (!activeFilter || !intelligence) return null;
    const intel = intelByDate[date];
    if (!intel) return null;

    if (activeFilter === 'understaffed' && intel.understaffed_probability > 0) {
      return {
        prob: intel.understaffed_probability,
        label: `${intel.understaffed_probability}% short-staff risk`,
        color: intel.understaffed_probability >= 60 ? '#991b1b' : '#92400e',
        bg:    intel.understaffed_probability >= 60 ? '#fef2f2' : '#fffbeb',
        border: intel.understaffed_probability >= 60 ? '#fca5a5' : '#fcd34d',
      };
    }
    if (activeFilter === 'overstaffed' && intel.overstaffed_probability > 0) {
      return {
        prob: intel.overstaffed_probability,
        label: `${intel.overstaffed_probability}% overstaffed`,
        color: '#1d4ed8',
        bg:    '#eff6ff',
        border: '#93c5fd',
      };
    }
    if (activeFilter === 'budget_flexible' && intel.budget_status === 'flexible') {
      const room = intel.budget_allocated > 0
        ? Math.round((1 - intel.budget_utilization_pct / 100) * intel.budget_allocated)
        : 0;
      return {
        prob: Math.round(100 - intel.budget_utilization_pct),
        label: `$${room} budget room (${intel.budget_utilization_pct.toFixed(0)}% used)`,
        color: '#15803d',
        bg:    '#f0fdf4',
        border: '#86efac',
      };
    }
    return null;
  };

  const hasAvailabilityWarning = (shift: ShiftWithEmployee) => {
    const rules = availabilityByEmployee[shift.employee_id];
    if (!rules || rules.length === 0) return false;
    const day = new Date(shift.date).getDay();
    const shiftStart = toMinutes(shift.start_time);
    const shiftEnd = toMinutes(shift.end_time);
    return !rules.some(rule => {
      if (rule.day_of_week !== day) return false;
      const start = toMinutes(rule.start_time);
      const end = toMinutes(rule.end_time);
      return shiftStart >= start && shiftEnd <= end;
    });
  };

  const handleDropEmployee = async (targetShift: ShiftWithEmployee, employeeId: number) => {
    if (!isManager || targetShift.employee_id === employeeId) return;

    // Check hours limit before dropping
    const employee = employees.find(e => e.id === employeeId);
    if (employee) {
      const currentHours = employeeHours[employeeId] ?? 0;
      const shiftDuration = shiftHours(targetShift.start_time, targetShift.end_time);
      if (currentHours + shiftDuration > employee.weekly_hours_max) {
        toast(`Cannot assign: ${employee.name} would exceed their ${employee.weekly_hours_max}h weekly limit (currently ${currentHours.toFixed(1)}h + ${shiftDuration.toFixed(1)}h = ${(currentHours + shiftDuration).toFixed(1)}h)`, { variant: 'warning' });
        return;
      }
    }

    setDropLoadingShiftId(targetShift.id);
    try {
      await updateShift(targetShift.id, { employee_id: employeeId });
      const refreshed = await getScheduleShifts(selectedId!);
      setShifts(refreshed);
    } catch (err: any) {
      toast('Error reassigning shift: ' + err.message, { variant: 'error' });
    } finally {
      setDropLoadingShiftId(null);
    }
  };

  const handleOpenAddShift = (date: string, slotKey: string) => {
    const slot = SHIFT_SLOTS.find(s => s.key === slotKey);
    const defaultStart = slot
      ? `${String(Math.floor(slot.min / 60)).padStart(2, '0')}:00`
      : '09:00';
    const defaultEnd = slot
      ? `${String(Math.floor(Math.min(slot.max, 23 * 60) / 60)).padStart(2, '0')}:00`
      : '17:00';
    setAddShiftForm({ employee_id: '', start_time: defaultStart, end_time: defaultEnd, role: 'Server' });
    setAddShiftCell({ date, slotKey });
  };

  const handleAddShift = async () => {
    if (!selectedId || !addShiftCell) return;
    setAddShiftSubmitting(true);
    try {
      const empId = addShiftForm.employee_id ? Number(addShiftForm.employee_id) : undefined;

      // Client-side hours check
      if (empId) {
        const employee = employees.find(e => e.id === empId);
        if (employee) {
          const currentHours = employeeHours[empId] ?? 0;
          const shiftDuration = shiftHours(addShiftForm.start_time, addShiftForm.end_time);
          if (currentHours + shiftDuration > employee.weekly_hours_max) {
            toast(`Cannot assign: ${employee.name} would exceed their ${employee.weekly_hours_max}h weekly limit (${currentHours.toFixed(1)}h + ${shiftDuration.toFixed(1)}h)`, { variant: 'warning' });
            setAddShiftSubmitting(false);
            return;
          }
        }
      }

      await createShift({
        schedule_id: selectedId,
        employee_id: empId,
        date: addShiftCell.date,
        start_time: addShiftForm.start_time,
        end_time: addShiftForm.end_time,
        role: addShiftForm.role,
      });
      const refreshed = await getScheduleShifts(selectedId);
      setShifts(refreshed);
      setAddShiftCell(null);
      toast('Shift added successfully.', { variant: 'success' });
    } catch (err: any) {
      toast('Error adding shift: ' + err.message, { variant: 'error' });
    } finally {
      setAddShiftSubmitting(false);
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    if (!isManager || !confirm('Remove this shift?')) return;
    try {
      await deleteShift(shiftId);
      const refreshed = await getScheduleShifts(selectedId!);
      setShifts(refreshed);
      toast('Shift removed.', { variant: 'default' });
    } catch (err: any) {
      toast('Error removing shift: ' + err.message, { variant: 'error' });
    }
  };

  const weekDates = selectedSchedule
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(selectedSchedule.week_start);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      })
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading schedule…
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <PageHeader
        title="Schedule Builder"
        subtitle="Generate, view, and publish weekly schedules"
        color="#0D9488"
        icon="📅"
      />

      {/* ── Controls Bar ── */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-card rounded-xl border border-border shadow-sm">
        {isManager && (
          <>
            <Input label="Week Starting" type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
            <Input
              label="Labor Budget ($)"
              type="number"
              className="w-32"
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              min={1000}
              step={500}
            />
            <Button
              variant="default"
              onClick={handleGenerate}
              disabled={generating}
              isLoading={generating}
              className="self-end"
            >
              Auto-Generate Schedule
            </Button>
          </>
        )}

        {schedules.length > 0 && (
          <>
            <div className="self-end space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">View Schedule</label>
              <select
                className={NATIVE_SELECT_CLASS}
                value={selectedId ?? ''}
                onChange={e => setSelectedId(Number(e.target.value))}
              >
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>Week of {s.week_start} ({s.status})</option>
                ))}
              </select>
            </div>
            {isManager && selectedSchedule && (
              <>
                <Button
                  variant={selectedSchedule.status === 'published' ? 'outline' : 'default'}
                  onClick={handlePublish}
                  className="self-end"
                >
                  {selectedSchedule.status === 'published' ? 'Unpublish' : 'Publish Schedule'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteSchedule}
                  className="self-end text-red-600 border-red-200 hover:bg-red-50"
                >
                  Delete Schedule
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Forecast Data Preview (drives schedule generation) ── */}
      {isManager && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Profitability Data Preview</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revenue forecasts, table turnover, and profitability metrics that will drive auto-generation
                {weekPreview?.pos_last_synced && (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    POS synced via {weekPreview.pos_last_synced.platform}
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              className="text-xs h-7 px-3"
              onClick={() => setShowPosPanel(v => !v)}
            >
              {showPosPanel ? 'Hide POS' : `POS Integrations${posIntegrations.length > 0 ? ` (${posIntegrations.length})` : ''}`}
            </Button>
          </div>

          {previewLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Loading forecast data…
            </div>
          ) : weekPreview ? (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                {[
                  { label: 'Expected Revenue', value: `$${weekPreview.total_expected_revenue.toLocaleString()}`, sub: 'week total' },
                  { label: 'Expected Covers', value: weekPreview.total_expected_covers.toLocaleString(), sub: 'guests' },
                  { label: 'Avg Check / Head', value: `$${weekPreview.avg_check_per_head.toFixed(2)}`, sub: 'per guest' },
                  { label: 'Table Turnover', value: `${weekPreview.table_turnover_rate}×`, sub: 'per service period' },
                  { label: 'Est. Labor Cost', value: `$${weekPreview.estimated_labor_cost.toLocaleString()}`, sub: `${weekPreview.settings.target_labor_pct}% target` },
                  { label: 'Prime Cost %', value: `${weekPreview.prime_cost_pct}%`, sub: weekPreview.prime_cost_pct <= 60 ? '✓ good' : weekPreview.prime_cost_pct <= 65 ? '⚠ warning' : '✗ over' },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{kpi.label}</p>
                    <p className="text-base font-bold text-foreground">{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>
                  </div>
                ))}
              </div>

              {/* Per-day revenue bar */}
              {weekPreview.has_forecast_data && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Daily Revenue Forecast</p>
                  <div className="flex items-end gap-1.5 h-16">
                    {weekPreview.forecasts.map(f => {
                      const maxRev = Math.max(...weekPreview.forecasts.map(d => d.expected_revenue), 1);
                      const heightPct = maxRev > 0 ? (f.expected_revenue / maxRev) * 100 : 0;
                      return (
                        <div key={f.date} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-muted-foreground">${(f.expected_revenue / 1000).toFixed(1)}k</span>
                          <div
                            className="w-full rounded-t bg-primary/70 transition-all"
                            style={{ height: `${Math.max(heightPct, 4)}%` }}
                            title={`${f.day_name}: $${f.expected_revenue.toLocaleString()} · ${f.expected_covers} covers`}
                          />
                          <span className="text-[9px] text-muted-foreground">{f.day_name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!weekPreview.has_forecast_data && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠ No forecast data found for this week. The algorithm will use default revenue estimates.
                  {posIntegrations.length > 0 ? ' Sync your POS integration to import data.' : ' Add a POS integration below to import live data.'}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground py-2">Select a week to preview forecast data.</p>
          )}

          {/* ── POS Integration Panel ── */}
          {showPosPanel && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-1">Point-of-Sale Integrations</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Connect your POS system to import live sales data into the forecast. The schedule algorithm
                uses this data to optimize staffing around actual revenue, table turnover, and covers.
              </p>

              {/* Existing integrations */}
              {posIntegrations.length > 0 && (
                <div className="space-y-2 mb-4">
                  {posIntegrations.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.last_sync_status === 'success' ? 'bg-emerald-500' : p.last_sync_status === 'error' ? 'bg-red-500' : 'bg-gray-400'}`} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.last_synced_at
                              ? `Last synced ${new Date(p.last_synced_at).toLocaleString()}${p.last_sync_revenue ? ` · $${p.last_sync_revenue.toLocaleString()} avg/week` : ''}`
                              : 'Not yet synced'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="text-xs h-7 px-2.5"
                          onClick={() => handleSyncPos(p.id)}
                          disabled={posSyncingId === p.id}
                          isLoading={posSyncingId === p.id}
                        >
                          Sync Now
                        </Button>
                        <button
                          onClick={() => handleDeletePosIntegration(p.id)}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                          title="Remove integration"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {posSyncMsg && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      {posSyncMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Add new integration form */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-muted-foreground">Platform</label>
                  <select
                    className={NATIVE_SELECT_CLASS}
                    value={addingPosForm.platform_name}
                    onChange={e => setAddingPosForm(f => ({ ...f, platform_name: e.target.value }))}
                  >
                    {POS_PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <Input
                  label="Display Name (optional)"
                  className="w-40"
                  value={addingPosForm.display_name}
                  onChange={e => setAddingPosForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="e.g. Main Location"
                />
                <Input
                  label="API Key / Token"
                  className="w-44"
                  value={addingPosForm.api_key}
                  onChange={e => setAddingPosForm(f => ({ ...f, api_key: e.target.value }))}
                  placeholder="sk-••••••••"
                />
                <Button
                  variant="default"
                  className="self-end"
                  onClick={handleAddPosIntegration}
                  disabled={posAddLoading}
                  isLoading={posAddLoading}
                >
                  Connect
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Schedule Status Banner ── */}
      {selectedSchedule && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={selectedSchedule.status === 'published' ? 'success' : 'secondary'}>
              {selectedSchedule.status === 'published' ? 'Published' : 'Draft'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Week of {selectedSchedule.week_start} · {shifts.length} shifts scheduled
            </span>
          </div>

          {/* ── View Filter Tabs ── */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-muted-foreground mr-1">Show:</span>
            {([
              { key: 'all',           label: '🗓 All Shifts' },
              { key: 'my_shifts',     label: '👤 My Shifts' },
              { key: 'my_department', label: '👥 My Department' },
            ] as { key: ViewFilter; label: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  viewFilter === tab.key
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Manager Intelligence Filter Bar ── */}
      {selectedSchedule && isManager && intelligence && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">Filters</span>

            {/* Short Staff */}
            <button
              onClick={() => setActiveFilter(f => f === 'understaffed' ? null : 'understaffed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                activeFilter === 'understaffed'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-card text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              Short Staff Risk
              {intelligence.understaffed_days > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === 'understaffed' ? 'bg-white/20' : 'bg-rose-100'}`}>
                  {intelligence.understaffed_days}d
                </span>
              )}
            </button>

            {/* Overstaffed */}
            <button
              onClick={() => setActiveFilter(f => f === 'overstaffed' ? null : 'overstaffed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                activeFilter === 'overstaffed'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-card text-blue-700 border-blue-200 hover:bg-blue-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              Overstaffed
              {intelligence.overstaffed_days > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === 'overstaffed' ? 'bg-white/20' : 'bg-blue-100'}`}>
                  {intelligence.overstaffed_days}d
                </span>
              )}
            </button>

            {/* Burnout Alert */}
            <button
              onClick={() => setActiveFilter(f => f === 'burnout' ? null : 'burnout')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                activeFilter === 'burnout'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-card text-orange-700 border-orange-200 hover:bg-orange-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Server Burnout Alert
              {intelligence.overall_burnout_alert_count > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === 'burnout' ? 'bg-white/20' : 'bg-orange-100'}`}>
                  {intelligence.overall_burnout_alert_count}
                </span>
              )}
            </button>

            {/* Budget Flexible */}
            <button
              onClick={() => setActiveFilter(f => f === 'budget_flexible' ? null : 'budget_flexible')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                activeFilter === 'budget_flexible'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-card text-emerald-700 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Labor Budget Flexible
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === 'budget_flexible' ? 'bg-white/20' : 'bg-emerald-100'}`}>
                {intelligence.budget_flexibility_pct.toFixed(0)}% slack
              </span>
            </button>

            {/* Clear filter */}
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                className="px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                ✕ Clear
              </button>
            )}

            {/* Summary chips */}
            <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Avg check: <strong>{intelligence.avg_check_per_head > 0 ? `$${intelligence.avg_check_per_head.toFixed(0)}` : 'N/A'}</strong></span>
              <span>·</span>
              <span>Table turnover: <strong>{intelligence.table_turnover_rate > 0 ? `${intelligence.table_turnover_rate.toFixed(1)}x` : 'N/A'}</strong></span>
              <span>·</span>
              <span>Labor cost: <strong>${intelligence.total_labor_cost.toLocaleString()}</strong> / ${intelligence.labor_budget.toLocaleString()}</span>
            </div>
          </div>

          {/* Filter legend */}
          {activeFilter && (
            <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
              {activeFilter === 'understaffed' && (
                <span>🔴 Highlighting days where actual staffing falls below the demand-based optimal. Probability is proportional to the shortfall.</span>
              )}
              {activeFilter === 'overstaffed' && (
                <span>🔵 Highlighting days where actual staffing exceeds optimal by more than 25%. Probability reflects excess relative to optimal.</span>
              )}
              {activeFilter === 'burnout' && (
                <span>🔶 Highlighting shift cards assigned to employees with a <strong>high</strong> burnout risk score based on consecutive days, clopens, and overtime.</span>
              )}
              {activeFilter === 'budget_flexible' && (
                <span>🟢 Highlighting days where labor cost is below 65% of the day's budget allocation — room to add shifts or increase hours.</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Weekly Calendar Grid + Employee Panel ── */}
      {selectedSchedule && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <div className="grid grid-cols-[120px_repeat(7,minmax(140px,1fr))] min-w-[1120px]">
              <div className="border-b border-r border-border bg-muted/30 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shift</div>
              {weekDates.map((date, idx) => {
                const overlay = getDayFilterOverlay(date);
                return (
                  <div
                    key={`hdr-${date}`}
                    className="border-b border-border border-r last:border-r-0 px-3 py-3 bg-muted/30 text-center relative"
                    style={overlay ? { backgroundColor: overlay.bg, borderColor: overlay.border } : undefined}
                  >
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{DAY_LABELS[idx]}</div>
                    <div className="text-sm font-bold text-foreground mt-0.5">{date.slice(5)}</div>
                    {overlay && (
                      <div
                        className="mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block"
                        style={{ color: overlay.color, backgroundColor: overlay.bg, border: `1px solid ${overlay.border}` }}
                      >
                        {overlay.label}
                      </div>
                    )}
                  </div>
                );
              })}

              {SHIFT_SLOTS.map((slot, rowIdx) => (
                <div key={`row-${slot.key}`} className="contents">
                  <div key={`slot-${slot.key}`} className={`border-r border-border px-3 py-3 text-sm font-semibold ${rowIdx < SHIFT_SLOTS.length - 1 ? 'border-b' : ''}`}>
                    {slot.label}
                  </div>
                  {weekDates.map((date, idx) => {
                    const slotShifts = shiftsByDateAndSlot[date]?.[slot.key] ?? [];
                    const overlay = getDayFilterOverlay(date);
                    return (
                      <div
                        key={`cell-${date}-${slot.key}`}
                        className={`border-r last:border-r-0 p-2 min-h-[140px] space-y-1.5 relative group/cell ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'} ${rowIdx < SHIFT_SLOTS.length - 1 ? 'border-b border-border' : ''}`}
                        style={overlay ? { backgroundColor: overlay.bg + '55' } : undefined}
                      >
                        {slotShifts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full min-h-[100px]">
                            <p className="text-xs text-muted-foreground/40 select-none">Open</p>
                            {isManager && (
                              <button
                                className="mt-2 opacity-0 group-hover/cell:opacity-100 transition-opacity w-6 h-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center text-sm font-bold"
                                title="Add shift"
                                onClick={() => handleOpenAddShift(date, slot.key)}
                              >
                                +
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {slotShifts.map(shift => {
                              const isOwnShift = shift.employee_id === user?.employeeId;
                              const canRequestSwap = shift.status !== 'swapped' &&
                                (user?.isManager || isOwnShift);
                              const canDrop = !user?.isManager && isOwnShift && shift.status !== 'swapped' && shift.status !== 'cancelled';
                              const warning = hasAvailabilityWarning(shift);
                              const isBurnoutShift = isBurnoutHighlightedEmployee(shift.employee_id);
                              return (
                                <div
                                  key={shift.id}
                                  className={`rounded-lg text-xs overflow-hidden relative group/shift ${dropLoadingShiftId === shift.id ? 'animate-pulse' : ''}`}
                                  style={isBurnoutShift
                                    ? { backgroundColor: '#fff7ed', color: '#9a3412', outline: '2px solid #f97316' }
                                    : shiftBlockStyle(shift.role)}
                                  onDragOver={e => isManager && e.preventDefault()}
                                  onDrop={e => {
                                    const employeeId = Number(e.dataTransfer.getData('text/plain'));
                                    if (employeeId) handleDropEmployee(shift, employeeId);
                                  }}
                                >
                                  <div className="flex">
                                    <div
                                      className="w-[3px] shrink-0 rounded-l-lg"
                                      style={{ backgroundColor: isBurnoutShift ? '#f97316' : shiftBarColor(shift.role) }}
                                    />
                                    <div className="flex-1 px-2 py-1.5 min-w-0">
                                      <div className="font-semibold truncate text-[11px]">
                                        {shift.employee_name}
                                      </div>
                                      <Badge variant={roleVariant(shift.role)} className="mt-0.5 text-[9px] px-1.5 py-0 h-4">{shift.role}</Badge>
                                      <div className="opacity-60 mt-1 text-[10px] font-medium">{shift.start_time}–{shift.end_time}</div>
                                      {warning && <p className="text-[10px] mt-1 text-amber-700 font-semibold">Availability warning</p>}
                                      {isBurnoutShift && (
                                        <p className="text-[10px] mt-1 font-bold text-orange-700">🔶 Burnout risk</p>
                                      )}
                                      {(canRequestSwap || canDrop) && (
                                        <div className="mt-1.5 flex items-center gap-2">
                                          {canRequestSwap && (
                                            <button
                                              className="text-[10px] underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
                                              onClick={() => handleOpenSwap(shift)}
                                            >
                                              🔄 Swap
                                            </button>
                                          )}
                                          {canDrop && (
                                            <button
                                              className="text-[10px] underline underline-offset-2 opacity-60 hover:opacity-100 text-rose-700 transition-opacity"
                                              onClick={() => handleOpenDrop(shift)}
                                            >
                                              ✕ Drop
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {isManager && (
                                      <button
                                        className="opacity-0 group-hover/shift:opacity-100 transition-opacity absolute top-1 right-1 w-4 h-4 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center text-[10px] font-bold"
                                        title="Remove shift"
                                        onClick={() => handleDeleteShift(shift.id)}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {isManager && (
                              <button
                                className="opacity-0 group-hover/cell:opacity-100 transition-opacity w-5 h-5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center text-xs font-bold mx-auto"
                                title="Add shift"
                                onClick={() => handleOpenAddShift(date, slot.key)}
                              >
                                +
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold text-foreground">Employee list</h3>
            <p className="text-xs text-muted-foreground mt-1">Drag employee cards onto a shift to reassign.</p>
            <div className="mt-3 space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {employees.map(employee => {
                const hours = employeeHours[employee.id] ?? 0;
                const utilization = Math.min(100, (hours / employee.weekly_hours_max) * 100);
                const burnout = burnoutByEmployee[employee.id];
                const availability = availabilityByEmployee[employee.id]?.length ?? 0;
                const isAtRisk = burnout?.risk_level === 'high' || utilization >= 95;
                const isAtMaxHours = hours >= employee.weekly_hours_max;
                const isBurnoutHighlight = isBurnoutHighlightedEmployee(employee.id);
                return (
                  <div
                    key={employee.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isBurnoutHighlight
                        ? 'border-orange-400 bg-orange-50/60'
                        : isAtMaxHours
                          ? 'border-rose-200 bg-rose-50/40 opacity-70'
                          : 'border-border bg-background/40'
                    }`}
                    draggable={isManager && !isAtMaxHours}
                    onDragStart={e => {
                      if (!isAtMaxHours) e.dataTransfer.setData('text/plain', String(employee.id));
                      else e.preventDefault();
                    }}
                    title={isAtMaxHours ? `${employee.name} is at their weekly hours limit` : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                          {employee.photo_url ? (
                            <img src={employee.photo_url} alt={employee.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center text-[10px] font-bold ${
                              { Manager: 'bg-violet-100 text-violet-700', Server: 'bg-blue-100 text-blue-700', Kitchen: 'bg-orange-100 text-orange-700', Bar: 'bg-emerald-100 text-emerald-700', Host: 'bg-pink-100 text-pink-700' }[employee.role] ?? 'bg-muted text-muted-foreground'
                            }`}>
                              {employee.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{employee.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isAtMaxHours && <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">MAX</span>}
                        {isBurnoutHighlight && <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">🔶 BURNOUT</span>}
                        <Badge variant={roleVariant(employee.role)}>{employee.role}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-2">
                      <span className="text-muted-foreground">Availability</span>
                      <span className={availability > 0 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                        {availability > 0 ? `${availability} rules` : 'No preferences'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className="text-muted-foreground">Hour tracking</span>
                      <span className={`font-medium ${isAtMaxHours ? 'text-rose-600' : ''}`}>{hours.toFixed(1)} / {employee.weekly_hours_max}h</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
                      <div className={`h-full ${isAtRisk ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${utilization}%` }} />
                    </div>
                    {isAtRisk && <p className="mt-1.5 text-[10px] font-semibold text-rose-600">Burnout alert</p>}
                    {isBurnoutHighlight && burnout && (
                      <p className="mt-1 text-[10px] text-orange-700">
                        Score {burnout.risk_score} · {burnout.consecutive_days}d consec · {burnout.clopens} clopens
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Empty state ── */}
      {schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center bg-card rounded-xl border border-border">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <p className="font-semibold text-foreground">No schedules yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isManager
              ? 'Set a week start date and labor budget above, then click "Auto-Generate Schedule" to create your first optimized schedule.'
              : 'No schedule has been published yet. Check back later.'}
          </p>
        </div>
      )}

      {/* ── Callout Coverage Panel ── */}
      {selectedSchedule && coverage && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">Callout Coverage &amp; Standby Pool</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                On-call employees reserved to cover last-minute callouts. Staffing scales with forecast revenue.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {coverage.days_at_risk > 0 ? (
                <Badge variant="warning">{coverage.days_at_risk} day{coverage.days_at_risk > 1 ? 's' : ''} at risk</Badge>
              ) : (
                <Badge variant="success">All days covered</Badge>
              )}
              <span className="text-xs text-muted-foreground">{coverage.total_standby_count} total standbys</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {coverage.days.map(day => {
              const statusColors: Record<string, { bg: string; border: string; label: string }> = {
                good:     { bg: '#f0fdf4', border: '#86efac', label: '#15803d' },
                at_risk:  { bg: '#fffbeb', border: '#fcd34d', label: '#92400e' },
                critical: { bg: '#fff1f2', border: '#fca5a5', label: '#991b1b' },
              };
              const colors = statusColors[day.coverage_status];
              const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.day_of_week];

              return (
                <div
                  key={day.date}
                  className="rounded-lg border p-2.5"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: colors.label }}>{dayLabel}</span>
                    {day.coverage_status === 'critical' && (
                      <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1 rounded">CRITICAL</span>
                    )}
                    {day.coverage_status === 'at_risk' && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded">AT RISK</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{day.date.slice(5)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    ${(day.expected_revenue / 1000).toFixed(1)}k rev
                  </p>
                  <p className="text-[11px] font-semibold mt-1.5" style={{ color: colors.label }}>
                    {day.standby_count} standby{day.standby_count !== 1 ? 's' : ''}
                  </p>
                  {day.standbys.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {day.standbys.map(s => (
                        <p key={s.id} className="text-[10px] text-muted-foreground truncate">
                          {s.employee_name} <span className="opacity-60">({s.role})</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Swap Request Modal ── */}
      {swapShift && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setSwapShift(null)}>
          <Card className="w-full max-w-md shadow-2xl overflow-hidden p-0">

            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Request Shift Swap</h2>
              <button
                onClick={() => setSwapShift(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Shift summary */}
            <div className="px-6 pt-4">
              <div className="rounded-xl p-3 flex items-center gap-2.5" style={shiftBlockStyle(swapShift.role)}>
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: shiftBarColor(swapShift.role) }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{swapShift.employee_name}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {swapShift.role} · {swapShift.date} · {swapShift.start_time}–{swapShift.end_time}
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="px-6 py-4 space-y-4">
              <Input
                label="Reason (optional)"
                type="text"
                placeholder="e.g. Doctor appointment"
                value={swapReason}
                onChange={e => setSwapReason(e.target.value)}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Swap with (optional)</label>
                <select
                  className={`w-full ${NATIVE_SELECT_CLASS}`}
                  value={swapTargetId}
                  onChange={e => setSwapTargetId(e.target.value)}
                >
                  <option value="">— Any available employee —</option>
                  {employees
                    .filter(e => e.id !== swapShift.employee_id && (e.role === swapShift.role || e.role === 'Manager'))
                    .map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-2 border-t border-border pt-4">
              <Button
                variant="default"
                className="flex-1"
                onClick={handleSubmitSwap}
                disabled={swapSubmitting}
                isLoading={swapSubmitting}
              >
                Submit Swap Request
              </Button>
              <Button variant="outline" onClick={() => setSwapShift(null)}>
                Cancel
              </Button>
            </div>

          </Card>
        </div>
      )}

      {/* ── Add Shift Modal ── */}
      {addShiftCell && isManager && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setAddShiftCell(null)}>
          <Card className="w-full max-w-sm shadow-2xl overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Add Shift</h2>
              <button
                onClick={() => setAddShiftCell(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Date: <span className="font-semibold text-foreground">{addShiftCell.date}</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Employee</label>
                <select
                  className={`w-full ${NATIVE_SELECT_CLASS}`}
                  value={addShiftForm.employee_id}
                  onChange={e => setAddShiftForm(f => ({ ...f, employee_id: e.target.value }))}
                >
                  <option value="">— Unassigned (open shift) —</option>
                  {employees.map(e => {
                    const hrs = employeeHours[e.id] ?? 0;
                    const atMax = hrs >= e.weekly_hours_max;
                    return (
                      <option key={e.id} value={e.id} disabled={atMax}>
                        {e.name} ({e.role}){atMax ? ` — MAX ${e.weekly_hours_max}h` : ` — ${hrs.toFixed(1)}/${e.weekly_hours_max}h`}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Role</label>
                <select
                  className={`w-full ${NATIVE_SELECT_CLASS}`}
                  value={addShiftForm.role}
                  onChange={e => setAddShiftForm(f => ({ ...f, role: e.target.value }))}
                >
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Time"
                  type="time"
                  value={addShiftForm.start_time}
                  onChange={e => setAddShiftForm(f => ({ ...f, start_time: e.target.value }))}
                />
                <Input
                  label="End Time"
                  type="time"
                  value={addShiftForm.end_time}
                  onChange={e => setAddShiftForm(f => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2 border-t border-border pt-4">
              <Button
                variant="default"
                className="flex-1"
                onClick={handleAddShift}
                disabled={addShiftSubmitting}
                isLoading={addShiftSubmitting}
              >
                Add Shift
              </Button>
              <Button variant="outline" onClick={() => setAddShiftCell(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Drop Shift Modal ── */}
      {dropShiftTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setDropShiftTarget(null)}>
          <Card className="w-full max-w-md shadow-2xl overflow-hidden p-0">

            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Drop Shift</h2>
              <button
                onClick={() => setDropShiftTarget(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Shift summary */}
            <div className="px-6 pt-4">
              <div className="rounded-xl p-3 flex items-center gap-2.5" style={shiftBlockStyle(dropShiftTarget.role)}>
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: shiftBarColor(dropShiftTarget.role) }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{dropShiftTarget.employee_name}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {dropShiftTarget.role} · {dropShiftTarget.date} · {dropShiftTarget.start_time}–{dropShiftTarget.end_time}
                  </p>
                </div>
              </div>

              {/* Last-minute warning */}
              {(() => {
                const shiftDt = new Date(`${dropShiftTarget.date}T${dropShiftTarget.start_time}:00`);
                const hrs = (shiftDt.getTime() - Date.now()) / (1000 * 60 * 60);
                if (hrs >= 0 && hrs <= 48) {
                  return (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                      <p className="font-semibold mb-0.5">⚠️ Last-minute drop ({hrs.toFixed(1)}h away)</p>
                      <p>Dropping within 48 hours will automatically notify your manager <em>and</em> send a pickup request to eligible coworkers via notifications and a group message in the app.</p>
                    </div>
                  );
                }
                return (
                  <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
                    <p>All of your coworkers at this location will receive a notification about this open shift opportunity so someone can pick it up.</p>
                  </div>
                );
              })()}
            </div>

            {/* Form */}
            <div className="px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Reason for dropping <span className="text-rose-600">*</span>
                </label>
                <select
                  className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${NATIVE_SELECT_CLASS}`}
                  value={dropReasonCategory}
                  onChange={e => setDropReasonCategory(e.target.value)}
                >
                  <option value="">Select a reason…</option>
                  <option value="Personal / family emergency">Personal / family emergency</option>
                  <option value="Medical appointment or illness">Medical appointment or illness</option>
                  <option value="Transportation issue">Transportation issue</option>
                  <option value="Schedule conflict">Schedule conflict</option>
                  <option value="Family care obligation">Family care obligation</option>
                  <option value="Academic commitment">Academic commitment</option>
                  <option value="Mental health day">Mental health day</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Additional details <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={2}
                  placeholder="Any extra context for your manager…"
                  value={dropReasonNote}
                  onChange={e => setDropReasonNote(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  This will be shared with your manager and included in the coworker pickup request.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-2 border-t border-border pt-4">
              <Button
                variant="default"
                className="flex-1 bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
                onClick={handleSubmitDrop}
                disabled={dropSubmitting || !dropReasonCategory}
                isLoading={dropSubmitting}
              >
                Submit Drop Request
              </Button>
              <Button variant="outline" onClick={() => setDropShiftTarget(null)}>
                Cancel
              </Button>
            </div>

          </Card>
        </div>
      )}
    </div>
  );
}
