import { useEffect, useState } from 'react';
import {
  getSchedules, generateSchedule, getScheduleShifts, updateSchedule,
  getEmployees, createSwap,
  Schedule, ShiftWithEmployee, Employee
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Input } from '../components/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ROLE_COLORS: Record<string, string> = {
  Manager: 'bg-purple-100 text-purple-800 border-purple-200',
  Server: 'bg-blue-100 text-blue-800 border-blue-200',
  Kitchen: 'bg-orange-100 text-orange-800 border-orange-200',
  Bar: 'bg-green-100 text-green-800 border-green-200',
  Host: 'bg-pink-100 text-pink-800 border-pink-200',
};

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

  // Swap modal state
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

  // Group shifts by date
  const shiftsByDate: Record<string, ShiftWithEmployee[]> = {};
  for (const shift of shifts) {
    shiftsByDate[shift.date] = shiftsByDate[shift.date] || [];
    shiftsByDate[shift.date].push(shift);
  }

  // Get the 7 days of the week
  const weekDates = selectedSchedule
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(selectedSchedule.week_start);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      })
    : [];

  if (loading) return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;

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
          variant="primary"
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
              <label className="block text-xs text-gray-500 mb-1">View Schedule</label>
              <select className="border rounded px-3 py-1.5 text-sm" value={selectedId ?? ''} onChange={e => setSelectedId(Number(e.target.value))}>
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>Week of {s.week_start} ({s.status})</option>
                ))}
              </select>
            </div>
            {selectedSchedule && (
              <Button
                variant={selectedSchedule.status === 'published' ? 'secondary' : 'primary'}
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
                <div key={date} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="bg-gray-50 border-b px-2 py-2 text-center">
                    <div className="text-xs font-semibold text-gray-500 uppercase">{DAYS[idx]}</div>
                    <div className="text-sm font-bold text-gray-800">{date.slice(5)}</div>
                  </div>
                  <div className="p-2 space-y-1 min-h-[120px]">
                    {dayShifts.length === 0 ? (
                      <p className="text-xs text-gray-300 text-center mt-4">No shifts</p>
                    ) : (
                      dayShifts.map(shift => {
                          const canRequestSwap = shift.status !== 'swapped' &&
                            (user?.isManager || shift.employee_id === user?.employeeId);
                          return (
                            <div
                              key={shift.id}
                              className={`rounded border px-1.5 py-1 text-xs ${ROLE_COLORS[shift.role] || 'bg-gray-100 text-gray-700'} ${shift.status === 'swapped' ? 'opacity-60 line-through' : ''}`}
                            >
                              <div className="font-semibold truncate">{shift.employee_name.split(' ')[0]}</div>
                              <div className="opacity-70">{shift.start_time}–{shift.end_time}</div>
                              {canRequestSwap && (
                                <button
                                  onClick={() => handleOpenSwap(shift)}
                                  className="mt-0.5 text-[10px] underline opacity-70 hover:opacity-100"
                                >
                                  Request Swap
                                </button>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {schedules.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No schedules yet.</p>
          <p className="mt-1 text-sm">Click "Auto-Generate Schedule" to create your first optimized schedule.</p>
        </div>
      )}

      {swapShift && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-1">Request Shift Swap</h2>
            <p className="text-sm text-gray-500 mb-4">
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
                <label className="block text-xs text-gray-500 mb-1">Swap with (optional)</label>
                <select
                  className="w-full border rounded px-3 py-1.5 text-sm"
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
            <div className="flex gap-2 mt-5">
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={handleSubmitSwap}
                disabled={swapSubmitting}
                isLoading={swapSubmitting}
              >
                {swapSubmitting ? 'Submitting…' : '🔄 Submit Swap Request'}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSwapShift(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}