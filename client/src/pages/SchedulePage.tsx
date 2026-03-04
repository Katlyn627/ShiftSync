import { useEffect, useState, CSSProperties } from 'react';
import {
  getSchedules, generateSchedule, getScheduleShifts, updateSchedule,
  getEmployees, createSwap,
  Schedule, ShiftWithEmployee, Employee
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Input, Card, Badge, NATIVE_SELECT_CLASS } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
  useEffect(() => { getEmployees().then(setEmployees).catch(err => console.error('Failed to load employees:', err)); }, []);

  useEffect(() => {
    if (!selectedId) return;
    getScheduleShifts(selectedId).then(setShifts).catch(() => setShifts([]));
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

  const shiftsByDate: Record<string, ShiftWithEmployee[]> = {};
  for (const shift of shifts) {
    shiftsByDate[shift.date] = shiftsByDate[shift.date] || [];
    shiftsByDate[shift.date].push(shift);
  }

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

      {/* ── Weekly Calendar Grid ── */}
      {selectedSchedule && (
        <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
          <div className="grid grid-cols-7 min-w-[840px]">
            {/* Day column headers */}
            {weekDates.map((date, idx) => (
              <div
                key={`hdr-${date}`}
                className="border-b border-border border-r last:border-r-0 px-3 py-3 bg-muted/30 text-center"
              >
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{DAYS[idx]}</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{date.slice(5)}</div>
              </div>
            ))}

            {/* Day cells */}
            {weekDates.map((date, idx) => {
              const dayShifts = shiftsByDate[date] || [];
              return (
                <div
                  key={`cell-${date}`}
                  className={`border-r last:border-r-0 p-2 min-h-[160px] space-y-1.5 ${idx % 2 === 0 ? 'bg-white' : 'bg-background/60'}`}
                >
                  {dayShifts.length === 0 ? (
                    <p className="text-xs text-muted-foreground/30 text-center mt-8 select-none">—</p>
                  ) : (
                    dayShifts.map(shift => {
                      const canRequestSwap = shift.status !== 'swapped' &&
                        (user?.isManager || shift.employee_id === user?.employeeId);
                      return (
                        <div
                          key={shift.id}
                          className={`rounded-lg text-xs overflow-hidden ${shift.status === 'swapped' ? 'opacity-40' : ''}`}
                          style={shiftBlockStyle(shift.role)}
                        >
                          <div className="flex">
                            <div
                              className="w-[3px] shrink-0 rounded-l-lg"
                              style={{ backgroundColor: shiftBarColor(shift.role) }}
                            />
                            <div className="flex-1 px-2 py-1.5 min-w-0">
                              <div
                                className="font-semibold truncate text-[11px]"
                                style={{ textDecoration: shift.status === 'swapped' ? 'line-through' : undefined }}
                              >
                                {shift.employee_name.split(' ')[0]}
                              </div>
                              <Badge
                                variant={roleVariant(shift.role)}
                                className="mt-0.5 text-[9px] px-1.5 py-0 h-4"
                              >
                                {shift.role}
                              </Badge>
                              <div className="opacity-60 mt-1 text-[10px] font-medium">
                                {shift.start_time}–{shift.end_time}
                              </div>
                              {canRequestSwap && (
                                <button
                                  className="mt-1 text-[10px] underline underline-offset-2 opacity-50 hover:opacity-100 transition-opacity"
                                  onClick={() => handleOpenSwap(shift)}
                                >
                                  Swap
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
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
    </div>
  );
}
