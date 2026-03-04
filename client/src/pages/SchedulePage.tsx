import { useEffect, useState, CSSProperties } from 'react';
import {
  getSchedules, generateSchedule, getScheduleShifts, updateSchedule,
  getEmployees, createSwap, updateShift, createShift, deleteShift, getBurnoutRisks, getAvailability,
  Schedule, ShiftWithEmployee, Employee, BurnoutRisk, Availability
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Input, Card, Badge, NATIVE_SELECT_CLASS } from '../components/ui';
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
  const [availabilityByEmployee, setAvailabilityByEmployee] = useState<Record<number, Availability[]>>({});
  const [dropLoadingShiftId, setDropLoadingShiftId] = useState<number | null>(null);

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

  useEffect(() => {
    if (!selectedId) return;
    getScheduleShifts(selectedId).then(setShifts).catch(() => setShifts([]));
    getBurnoutRisks(selectedId).then(setBurnoutRisks).catch(() => setBurnoutRisks([]));
  }, [selectedId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const s = await generateSchedule(weekStart, budget);
      await load();
      setSelectedId(s.id);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedId) return;
    const s = schedules.find(sc => sc.id === selectedId);
    if (!s) return;
    const newStatus = s.status === 'published' ? 'draft' : 'published';
    await updateSchedule(selectedId, { status: newStatus });
    await load();
  };

  const handleOpenSwap = (shift: ShiftWithEmployee) => {
    setSwapShift(shift);
    setSwapReason('');
    setSwapTargetId('');
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
      alert('Swap request submitted! A manager will review it shortly.');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSwapSubmitting(false);
    }
  };

  const selectedSchedule = schedules.find(s => s.id === selectedId);

  const shiftsByDateAndSlot: Record<string, Record<ShiftSlotKey, ShiftWithEmployee[]>> = {};
  const employeeHours: Record<number, number> = {};
  for (const shift of shifts) {
    shiftsByDateAndSlot[shift.date] ??= { morning: [], mid: [], evening: [], close: [] };
    shiftsByDateAndSlot[shift.date][shiftSlot(shift.start_time)].push(shift);
    employeeHours[shift.employee_id] = (employeeHours[shift.employee_id] ?? 0) + shiftHours(shift.start_time, shift.end_time);
  }

  const burnoutByEmployee = Object.fromEntries(burnoutRisks.map(risk => [risk.employee_id, risk]));

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
        alert(`Cannot assign: ${employee.name} would exceed their ${employee.weekly_hours_max}h weekly limit (currently ${currentHours.toFixed(1)}h + ${shiftDuration.toFixed(1)}h = ${(currentHours + shiftDuration).toFixed(1)}h)`);
        return;
      }
    }

    setDropLoadingShiftId(targetShift.id);
    try {
      await updateShift(targetShift.id, { employee_id: employeeId });
      const refreshed = await getScheduleShifts(selectedId!);
      setShifts(refreshed);
    } catch (err: any) {
      alert('Error: ' + err.message);
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
            alert(`Cannot assign: ${employee.name} would exceed their ${employee.weekly_hours_max}h weekly limit (${currentHours.toFixed(1)}h + ${shiftDuration.toFixed(1)}h)`);
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
    } catch (err: any) {
      alert('Error: ' + err.message);
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
    } catch (err: any) {
      alert('Error: ' + err.message);
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
      <div>
        <h1 className="text-xl font-bold text-foreground">Schedule Builder</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Generate, view, and publish weekly schedules</p>
      </div>

      {/* ── Controls Bar ── */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-xl border border-border shadow-sm">
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
              <Button
                variant={selectedSchedule.status === 'published' ? 'outline' : 'default'}
                onClick={handlePublish}
                className="self-end"
              >
                {selectedSchedule.status === 'published' ? 'Unpublish' : 'Publish Schedule'}
              </Button>
            )}
          </>
        )}
      </div>

      {/* ── Schedule Status Banner ── */}
      {selectedSchedule && (
        <div className="flex items-center gap-2">
          <Badge variant={selectedSchedule.status === 'published' ? 'success' : 'secondary'}>
            {selectedSchedule.status === 'published' ? 'Published' : 'Draft'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Week of {selectedSchedule.week_start} · {shifts.length} shifts scheduled
          </span>
        </div>
      )}

      {/* ── Weekly Calendar Grid + Employee Panel ── */}
      {selectedSchedule && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
            <div className="grid grid-cols-[120px_repeat(7,minmax(140px,1fr))] min-w-[1120px]">
              <div className="border-b border-r border-border bg-muted/30 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shift</div>
              {weekDates.map((date, idx) => (
                <div key={`hdr-${date}`} className="border-b border-border border-r last:border-r-0 px-3 py-3 bg-muted/30 text-center">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{DAY_LABELS[idx]}</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">{date.slice(5)}</div>
                </div>
              ))}

              {SHIFT_SLOTS.map((slot, rowIdx) => (
                <div key={`row-${slot.key}`} className="contents">
                  <div key={`slot-${slot.key}`} className={`border-r border-border px-3 py-3 text-sm font-semibold ${rowIdx < SHIFT_SLOTS.length - 1 ? 'border-b' : ''}`}>
                    {slot.label}
                  </div>
                  {weekDates.map((date, idx) => {
                    const slotShifts = shiftsByDateAndSlot[date]?.[slot.key] ?? [];
                    return (
                      <div
                        key={`cell-${date}-${slot.key}`}
                        className={`border-r last:border-r-0 p-2 min-h-[140px] space-y-1.5 relative group/cell ${idx % 2 === 0 ? 'bg-white' : 'bg-background/60'} ${rowIdx < SHIFT_SLOTS.length - 1 ? 'border-b border-border' : ''}`}
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
                              const canRequestSwap = shift.status !== 'swapped' &&
                                (user?.isManager || shift.employee_id === user?.employeeId);
                              const warning = hasAvailabilityWarning(shift);
                              return (
                                <div
                                  key={shift.id}
                                  className={`rounded-lg text-xs overflow-hidden relative group/shift ${shift.status === 'swapped' ? 'opacity-40' : ''} ${dropLoadingShiftId === shift.id ? 'animate-pulse' : ''}`}
                                  style={shiftBlockStyle(shift.role)}
                                  onDragOver={e => isManager && e.preventDefault()}
                                  onDrop={e => {
                                    const employeeId = Number(e.dataTransfer.getData('text/plain'));
                                    if (employeeId) handleDropEmployee(shift, employeeId);
                                  }}
                                >
                                  <div className="flex">
                                    <div className="w-[3px] shrink-0 rounded-l-lg" style={{ backgroundColor: shiftBarColor(shift.role) }} />
                                    <div className="flex-1 px-2 py-1.5 min-w-0">
                                      <div className="font-semibold truncate text-[11px]" style={{ textDecoration: shift.status === 'swapped' ? 'line-through' : undefined }}>
                                        {shift.employee_name}
                                      </div>
                                      <Badge variant={roleVariant(shift.role)} className="mt-0.5 text-[9px] px-1.5 py-0 h-4">{shift.role}</Badge>
                                      <div className="opacity-60 mt-1 text-[10px] font-medium">{shift.start_time}–{shift.end_time}</div>
                                      {warning && <p className="text-[10px] mt-1 text-amber-700 font-semibold">Availability warning</p>}
                                      {canRequestSwap && (
                                        <button
                                          className="mt-1 text-[10px] underline underline-offset-2 opacity-50 hover:opacity-100 transition-opacity"
                                          onClick={() => handleOpenSwap(shift)}
                                        >
                                          Swap
                                        </button>
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
                return (
                  <div
                    key={employee.id}
                    className={`rounded-lg border p-3 ${isAtMaxHours ? 'border-rose-200 bg-rose-50/40 opacity-70' : 'border-border bg-background/40'}`}
                    draggable={isManager && !isAtMaxHours}
                    onDragStart={e => {
                      if (!isAtMaxHours) e.dataTransfer.setData('text/plain', String(employee.id));
                      else e.preventDefault();
                    }}
                    title={isAtMaxHours ? `${employee.name} is at their weekly hours limit` : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{employee.name}</p>
                      <div className="flex items-center gap-1">
                        {isAtMaxHours && <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">MAX</span>}
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
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Empty state ── */}
      {schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center bg-white rounded-xl border border-border">
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
    </div>
  );
}
