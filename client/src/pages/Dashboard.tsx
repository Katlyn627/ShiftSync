import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  getSchedules, getLaborCost, getBurnoutRisks, getStaffingSuggestions,
  Schedule, LaborCostSummary, BurnoutRisk, DailyStaffingSuggestion
} from '../api';
import { useAuth } from '../AuthContext';
import { Card, Badge } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

const RISK_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

function riskVariant(level: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = { high: 'danger', medium: 'warning', low: 'success' };
  return map[level] ?? 'default';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard() {
  const { user } = useAuth();
  const isManager = user?.isManager ?? false;
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [laborCost, setLaborCost] = useState<LaborCostSummary | null>(null);
  const [burnout, setBurnout] = useState<BurnoutRisk[]>([]);
  const [staffingSuggestions, setStaffingSuggestions] = useState<DailyStaffingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSchedules().then(s => {
      setSchedules(s);
      if (s.length > 0) setSelectedId(s[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (isManager) {
      getLaborCost(selectedId).then(setLaborCost).catch(() => setLaborCost(null));
    }
    getBurnoutRisks(selectedId).then(setBurnout).catch(() => setBurnout([]));
  }, [selectedId, isManager]);

  // Load staffing suggestions for the selected schedule's week (manager only)
  useEffect(() => {
    if (!isManager) return;
    const schedule = schedules.find(s => s.id === selectedId);
    if (!schedule) return;
    getStaffingSuggestions(schedule.week_start)
      .then(setStaffingSuggestions)
      .catch(() => setStaffingSuggestions([]));
  }, [selectedId, schedules, isManager]);

  if (loading) return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;

  if (schedules.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg">No schedules yet.</p>
        <p className="text-gray-400 mt-1">Go to the Schedule tab to generate one.</p>
      </div>
    );
  }

  const highRisk = burnout.filter(b => b.risk_level === 'high');
  const mediumRisk = burnout.filter(b => b.risk_level === 'medium');
  const budgetPct = laborCost ? (laborCost.projected_cost / laborCost.labor_budget) * 100 : 0;
  const overBudget = laborCost && laborCost.variance > 0;

  // Aggregate total staff needed per day for the staffing chart
  const staffingChartData = staffingSuggestions.map(day => ({
    day: DAY_NAMES[day.day_of_week],
    date: day.date,
    total: day.staffing.reduce((sum, s) => sum + s.count, 0),
    revenue: day.expected_revenue,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={selectedId ?? ''}
          onChange={e => setSelectedId(Number(e.target.value))}
        >
          {schedules.map(s => (
            <option key={s.id} value={s.id}>
              Week of {s.week_start} ({s.status})
            </option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isManager && (
          <KpiCard
            label="Projected Labor Cost"
            value={laborCost ? `$${laborCost.projected_cost.toLocaleString()}` : '—'}
            sub={laborCost ? `Budget: $${laborCost.labor_budget.toLocaleString()}` : ''}
            color={overBudget ? 'red' : 'green'}
          />
        )}
        {isManager && (
          <KpiCard
            label="Budget Usage"
            value={laborCost ? `${budgetPct.toFixed(1)}%` : '—'}
            sub={overBudget ? `$${Math.abs(laborCost!.variance).toFixed(0)} over` : laborCost ? `$${Math.abs(laborCost.variance).toFixed(0)} under` : ''}
            color={budgetPct > 100 ? 'red' : budgetPct > 90 ? 'yellow' : 'green'}
          />
        )}
        <KpiCard
          label="High Burnout Risk"
          value={highRisk.length.toString()}
          sub={highRisk.length > 0 ? highRisk.map(b => b.employee_name.split(' ')[0]).join(', ') : 'All clear'}
          color={highRisk.length > 0 ? 'red' : 'green'}
        />
        <KpiCard
          label="Medium Burnout Risk"
          value={mediumRisk.length.toString()}
          sub="employees need attention"
          color={mediumRisk.length > 2 ? 'yellow' : 'green'}
        />
      </div>

      {/* Demand-Based Staffing Suggestions (manager only) */}
      {isManager && staffingChartData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-1 text-gray-700">📊 Demand-Based Staffing Suggestions</h2>
          <p className="text-xs text-gray-400 mb-4">Recommended staff count per day based on forecast revenue</p>
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {staffingSuggestions.map(day => {
              const totalStaff = day.staffing.reduce((sum, s) => sum + s.count, 0);
              const roleGroups: Record<string, number> = {};
              for (const s of day.staffing) {
                roleGroups[s.role] = (roleGroups[s.role] || 0) + s.count;
              }
              return (
                <div key={day.date} className="bg-gray-50 rounded-lg p-2 border">
                  <div className="font-semibold text-gray-600">{DAY_NAMES[day.day_of_week]}</div>
                  <div className="text-gray-400">{day.date.slice(5)}</div>
                  <div className="text-lg font-bold text-blue-600 mt-1">{totalStaff}</div>
                  <div className="text-gray-400">staff</div>
                  {day.expected_revenue > 0 && (
                    <div className="text-gray-500 mt-1">${(day.expected_revenue / 1000).toFixed(1)}k</div>
                  )}
                  <div className="mt-1 space-y-0.5">
                    {Object.entries(roleGroups).map(([role, count]) => (
                      <div key={role} className="text-gray-500">{count} {role}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Labor Cost Chart (manager only) */}
      {isManager && laborCost && laborCost.by_day.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Daily Labor Cost</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={laborCost.by_day}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']} labelFormatter={l => `Date: ${l}`} />
              <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                {laborCost.by_day.map((_, i) => <Cell key={i} fill="#3b82f6" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Cost by Role + Burnout Risks side-by-side */}
      <div className="grid md:grid-cols-2 gap-4">
        {isManager && laborCost && laborCost.by_role.length > 0 && (
          <Card>
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Cost by Role</h2>
            <div className="space-y-2">
              {laborCost.by_role.map(r => (
                <div key={r.role} className="flex items-center gap-2">
                  <span className="text-sm w-24 text-gray-600">{r.role}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-4 bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, (r.cost / laborCost.projected_cost) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-16 text-right">${r.cost.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">🔥 Burnout Risk Monitor</h2>
          {burnout.length === 0 ? (
            <p className="text-gray-400 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {burnout.map(b => (
                <div key={b.employee_id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                  <span
                    className="mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: RISK_COLORS[b.risk_level] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{b.employee_name}</span>
                      <span className="text-xs text-gray-500">{b.weekly_hours}h/wk</span>
                    </div>
                    {b.factors.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{b.factors.join(' · ')}</p>
                    )}
                    {b.rest_days_recommended > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        💤 {b.rest_days_recommended} rest day{b.rest_days_recommended > 1 ? 's' : ''} recommended
                      </p>
                    )}
                  </div>
                  <Badge variant={riskVariant(b.risk_level)}>{b.risk_level.toUpperCase()}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'border-green-200 bg-green-50 text-green-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.green}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}