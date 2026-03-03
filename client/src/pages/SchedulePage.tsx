import { useEffect, useState } from 'react';
import {
  getSchedules, generateSchedule, getScheduleShifts, updateSchedule,
  Schedule, ShiftWithEmployee
} from '../api';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ROLE_COLORS: Record<string, string> = {
  Manager: 'bg-purple-100 text-purple-800 border-purple-200',
  Server: 'bg-blue-100 text-blue-800 border-blue-200',
  Kitchen: 'bg-orange-100 text-orange-800 border-orange-200',
  Bar: 'bg-green-100 text-green-800 border-green-200',
  Host: 'bg-pink-100 text-pink-800 border-pink-200',
};

export default function SchedulePage() {
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
          <label className="block text-xs text-gray-500 mb-1">Week Starting</label>
          <input type="date" className="border rounded px-3 py-1.5 text-sm" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Labor Budget ($)</label>
          <input type="number" className="border rounded px-3 py-1.5 text-sm w-28" value={budget} onChange={e => setBudget(Number(e.target.value))} min={1000} step={500} />
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? '⚙️ Generating...' : '⚡ Auto-Generate Schedule'}
        </button>

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
              <button
                onClick={handlePublish}
                className={`px-4 py-1.5 rounded text-sm font-medium ${selectedSchedule.status === 'published' ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-green-600 text-white hover:bg-green-700'}`}
              >
                {selectedSchedule.status === 'published' ? 'Unpublish' : '✅ Publish Schedule'}
              </button>
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
                      dayShifts.map(shift => (
                        <div
                          key={shift.id}
                          className={`rounded border px-1.5 py-1 text-xs ${ROLE_COLORS[shift.role] || 'bg-gray-100 text-gray-700'} ${shift.status === 'swapped' ? 'opacity-60 line-through' : ''}`}
                        >
                          <div className="font-semibold truncate">{shift.employee_name.split(' ')[0]}</div>
                          <div className="opacity-70">{shift.start_time}–{shift.end_time}</div>
                        </div>
                      ))
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
    </div>
  );
}
