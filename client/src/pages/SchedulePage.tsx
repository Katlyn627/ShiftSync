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
    Server: 'server',
    Kitchen: 'kitchen',
    Bar: 'bar',
    Host: 'host',
  };
  return map[role] ?? 'default';
}

/** Role color map — Tailwind v400/v800 equivalents as CSS hex for shift block inline styles. */
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  manager: { bg: '#f3e8ff', text: '#6b21a8' }, // violet-100 / violet-800
  server:  { bg: '#dbeafe', text: '#1e40af' }, // blue-100 / blue-800
  kitchen: { bg: '#ffedd5', text: '#9a3412' }, // orange-100 / orange-800
  bar:     { bg: '#dcfce7', text: '#166534' }, // green-100 / green-800
  host:    { bg: '#fce7f3', text: '#9d174d' }, // pink-100 / pink-800
};

function shiftBlockStyle(role: string): CSSProperties {
  const c = ROLE_COLORS[role.toLowerCase()] ?? { bg: '#f1f5f9', text: '#334155' };
  return { backgroundColor: c.bg, color: c.text, borderColor: c.text + '40' };
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  });
  const [budget, setBudget] = useState(5000);

  const [swapShift, setSwapShift] = useState<ShiftWithEmployee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [swapReason, setSwapReason] = useState('');
  const [swapTargetId, setSwapTargetId] = useState('');
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
        shift_id: swapShift.id,
        requester_id: user.employeeId,
        target_id: swapTargetId ? Number(swapTargetId) : undefined,
        reason: swapReason || undefined,
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

  if (loading) return <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Input
            label="Week Starting"
            type="date"
            value={weekStart}
            onChange={e => setWeekStart(e.target.value)}
          />
        </div>
        <div>
          <Input
            label="Labor Budget ($)"
            type="number"
            className="w-28"
            value={budget}
            onChange={e => setBudget(Number(e.target.value))}
            min={1000}
            step={500}
          />
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
          isLoading={generating}
        >
          ⚡ Auto-Generate Schedule
        </Button>

        {schedules.length > 0 && (
          <>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">View Schedule</label>
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
            {selectedSchedule && (
              <Button
                variant={selectedSchedule.status === 'published' ? 'secondary' : 'default'}
                size="sm"
                onClick={handlePublish}
              >
                {selectedSchedule.status === 'published' ? 'Unpublish' : '✅ Publish Schedule'}
              </Button>
            )}
          </>
        )}
      </div>

      {selectedSchedule && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 min-w-[900px]">
            {weekDates.map((date, idx) => {
              const dayShifts = shiftsByDate[date] || [];
              return (
                <Card key={date} className="overflow-hidden gap-0">
                  <div className="bg-muted/30 border-b px-2 py-2 text-center">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">{DAYS[idx]}</div>
                    <div className="text-sm font-bold text-foreground">{date.slice(5)}</div>
                  </div>
                  <div className="p-2 space-y-1 min-h-[120px]">
                    {dayShifts.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 text-center mt-4">No shifts</p>
                    ) : (
                      dayShifts.map(shift => {
                        const canRequestSwap = shift.status !== 'swapped' &&
                          (user?.isManager || shift.employee_id === user?.employeeId);
                        return (
                          <div
                            key={shift.id}
                            className={`rounded border px-1.5 py-1 text-xs ${shift.status === 'swapped' ? 'opacity-60 line-through' : ''}`}
                            style={shiftBlockStyle(shift.role)}
                          >
                            <div className="font-semibold truncate">{shift.employee_name.split(' ')[0]}</div>
                            <Badge variant={roleVariant(shift.role)} className="mt-0.5">{shift.role}</Badge>
                            <div className="opacity-70 mt-0.5">{shift.start_time}–{shift.end_time}</div>
                            {canRequestSwap && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-0.5 !px-0 !py-0 text-[10px] h-auto underline opacity-70 hover:opacity-100"
                                onClick={() => handleOpenSwap(shift)}
                              >
                                Request Swap
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {schedules.length === 0 && (
        <div className="text-center py-20 text-muted-foreground/70">
          <p className="text-lg">No schedules yet.</p>
          <p className="mt-1 text-sm">Click "Auto-Generate Schedule" to create your first optimized schedule.</p>
        </div>
      )}

      {swapShift && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Card className="w-full max-w-md shadow-xl p-6">
            <h2 className="text-lg font-bold mb-1">Request Shift Swap</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your <span className="font-medium">{swapShift.role}</span> shift on{' '}
              <span className="font-medium">{swapShift.date}</span>{' '}
              ({swapShift.start_time}–{swapShift.end_time})
            </p>
            <div className="space-y-3">
              <div>
                <Input
                  label="Reason (optional)"
                  type="text"
                  placeholder="e.g. Doctor appointment"
                  value={swapReason}
                  onChange={e => setSwapReason(e.target.value)}
                />
              </div>
              <div>
                <div className="flex flex-col gap-1">
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
            </div>
            <div className="flex gap-2 mt-5">
              <Button
                variant="default"
                size="default"
                className="flex-1"
                onClick={handleSubmitSwap}
                disabled={swapSubmitting}
                isLoading={swapSubmitting}
              >
                {swapSubmitting ? 'Submitting…' : '🔄 Submit Swap Request'}
              </Button>
              <Button
                variant="secondary"
                size="default"
                onClick={() => setSwapShift(null)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
