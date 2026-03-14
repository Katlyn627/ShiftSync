import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import {
  getFairnessReport, getInstabilityReport, getSchedules,
  FairnessReport, InstabilityReport, Schedule,
} from '../api';

export default function FairnessPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [fairness, setFairness] = useState<FairnessReport | null>(null);
  const [instability, setInstability] = useState<InstabilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fairness' | 'instability'>('fairness');

  useEffect(() => {
    getSchedules().then(s => {
      setSchedules(s);
      if (s.length > 0) setSelectedScheduleId(s[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedScheduleId) return;
    loadData(selectedScheduleId);
  }, [selectedScheduleId]);

  async function loadData(scheduleId: number) {
    setLoading(true);
    setError(null);
    try {
      const [f, ins] = await Promise.all([
        getFairnessReport({ schedule_id: scheduleId }),
        getInstabilityReport({ schedule_id: scheduleId }),
      ]);
      setFairness(f);
      setInstability(ins?.[0] ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function flagBadge(flag: string) {
    const map: Record<string, string> = {
      high_hours: 'bg-orange-100 text-orange-800',
      concentrated_nights: 'bg-purple-100 text-purple-800',
      concentrated_weekends: 'bg-blue-100 text-blue-800',
      overtime: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      high_hours: '⚠ High Hours', concentrated_nights: '🌙 Night Concentration',
      concentrated_weekends: '📅 Weekend Concentration', overtime: '⏱ Overtime',
    };
    return (
      <span key={flag} className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-1 ${map[flag] ?? 'bg-gray-100'}`}>
        {labels[flag] ?? flag}
      </span>
    );
  }

  function instabilityBadge(level: string) {
    const map = { stable: 'bg-green-100 text-green-800', moderate: 'bg-yellow-100 text-yellow-800', volatile: 'bg-red-100 text-red-800' };
    return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${map[level as keyof typeof map] ?? 'bg-gray-100'}`}>{level}</span>;
  }

  function scoreBar(score: number) {
    const color = score < 15 ? 'bg-green-500' : score < 35 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, score)}%` }} />
        </div>
        <span className="text-xs font-semibold w-8 text-right">{score}</span>
      </div>
    );
  }

  if (!user?.isManager) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Workforce Analytics</h1>
        <p className="text-gray-500">This section is available to managers only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Workforce Fairness &amp; Schedule Instability</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor equitable distribution of schedule burden and identify schedule instability/predictability-pay exposure.
        </p>
      </div>

      {/* Schedule selector */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Schedule</label>
          <select
            value={selectedScheduleId ?? ''}
            onChange={e => setSelectedScheduleId(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {schedules.map(s => <option key={s.id} value={s.id}>{s.week_start} ({s.status})</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-4">
          {(['fairness', 'instability'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {tab === 'fairness' ? '⚖️ Fairness Distribution' : '📊 Schedule Instability'}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading analytics…</div>
      ) : activeTab === 'fairness' ? (
        fairness && (
          <div className="space-y-6">
            {/* Summary */}
            {fairness.summary && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{fairness.summary.total_employees}</div>
                  <div className="text-sm text-gray-500">Employees</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{fairness.summary.total_shifts}</div>
                  <div className="text-sm text-gray-500">Total Shifts</div>
                </div>
                <div className={`rounded-xl border p-4 text-center ${fairness.summary.employees_with_flags > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                  <div className={`text-2xl font-bold ${fairness.summary.employees_with_flags > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                    {fairness.summary.employees_with_flags}
                  </div>
                  <div className="text-sm text-gray-500">Fairness Flags</div>
                </div>
              </div>
            )}

            {/* Role distribution */}
            {fairness.role_stats.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Distribution by Role</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {['Role', 'Employees', 'Avg Hours', 'Avg Night Shifts', 'Avg Weekend Shifts', 'Hours Std Dev', 'Fairness'].map(h => (
                          <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fairness.role_stats.map(r => (
                        <tr key={r.role} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 pr-4 font-medium text-gray-900">{r.role}</td>
                          <td className="py-2 pr-4 text-gray-600">{r.employee_count}</td>
                          <td className="py-2 pr-4 text-gray-600">{r.avg_hours}h</td>
                          <td className="py-2 pr-4 text-gray-600">{r.avg_night_shifts}</td>
                          <td className="py-2 pr-4 text-gray-600">{r.avg_weekend_shifts}</td>
                          <td className="py-2 pr-4 text-gray-600">±{r.hours_std_dev}h</td>
                          <td className="py-2 pr-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.fairness_score === 'equitable' ? 'bg-green-100 text-green-800' : r.fairness_score === 'moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                              {r.fairness_score}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Individual employees with flags */}
            {fairness.employees.filter(e => e.fairness_flags.length > 0).length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">⚠ Employees with Fairness Flags</h2>
                <div className="space-y-2">
                  {fairness.employees.filter(e => e.fairness_flags.length > 0).map(emp => (
                    <div key={emp.employee_id} className="bg-white rounded-xl border border-orange-200 p-3 flex flex-wrap items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">{emp.employee_name}</span>
                        <span className="text-gray-500 text-sm ml-2">{emp.role}</span>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {emp.total_hours}h total &bull; {emp.night_shifts} night &bull; {emp.weekend_shifts} weekend
                          {emp.overtime_hours > 0 && <span className="text-red-600 font-medium"> &bull; {emp.overtime_hours}h overtime</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {emp.fairness_flags.map(f => flagBadge(f))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        instability && (
          <div className="space-y-6">
            {/* Instability score */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Instability Score</h2>
                {instabilityBadge(instability.instability_level)}
              </div>
              {scoreBar(instability.instability_score)}
              <p className="text-xs text-gray-500 mt-2">
                Composite of: cancellation rate, quick returns (short rest), callout frequency, and late schedule changes.
              </p>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Cancelled Shifts', value: `${instability.cancelled_shifts} (${instability.cancellation_rate_pct}%)`, alert: instability.cancellation_rate_pct > 10 },
                { label: 'Quick Returns', value: instability.quick_returns, alert: instability.quick_returns > 0 },
                { label: 'Callouts', value: instability.callout_count, alert: instability.callout_count > 2 },
                { label: 'Late Changes', value: instability.late_change_count, alert: instability.late_change_count > 0 },
              ].map(m => (
                <div key={m.label} className={`rounded-xl border p-4 text-center ${m.alert ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                  <div className={`text-2xl font-bold ${m.alert ? 'text-red-700' : 'text-gray-900'}`}>{m.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Predictability pay exposure */}
            <div className={`rounded-xl border p-5 ${instability.predictability_pay_exposure_count > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
              <h3 className="font-semibold text-gray-900 mb-1">Predictability-Pay Exposure</h3>
              <p className="text-sm text-gray-700">
                <strong>{instability.predictability_pay_exposure_count} shift{instability.predictability_pay_exposure_count !== 1 ? 's' : ''}</strong> may trigger predictability pay.{' '}
                Schedule published <strong>{instability.days_advance_published} days</strong> before week start
                (required: {instability.required_advance_days} days).
              </p>
              {instability.predictability_pay_exposure_count > 0 && (
                <p className="text-xs text-amber-700 mt-2">
                  ⚠ Review local fair workweek ordinances (NYC, SF, Chicago, etc.) to confirm whether premium pay applies for short-notice changes.
                </p>
              )}
            </div>

            {/* Schedule summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Schedule Summary</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Week start</span><span className="font-medium">{instability.week_start}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total shifts</span><span className="font-medium">{instability.total_shifts}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Active shifts</span><span className="font-medium">{instability.active_shifts}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Change requests</span><span className="font-medium">{instability.change_requests}</span></div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
