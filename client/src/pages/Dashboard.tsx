import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie,
} from 'recharts';
import {
  getSchedules, getLaborCost, getBurnoutRisks, getStaffingSuggestions,
  getEmployees, getScheduleShifts, getTurnoverRisks, getEmployeeStats,
  Schedule, LaborCostSummary, BurnoutRisk, DailyStaffingSuggestion,
  Employee, ShiftWithEmployee, TurnoverRisk, EmployeeStats,
} from '../api';
import { useAuth } from '../AuthContext';
import { Card, Badge, NATIVE_SELECT_CLASS } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

const RISK_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
};

function riskVariant(level: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = { high: 'danger', medium: 'warning', low: 'success' };
  return map[level] ?? 'default';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function shiftHours(start: string, end: string): number {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e < s) e += 24 * 60;
  return (e - s) / 60;
}

/* KPI Card */
function KpiCard({
  label, value, sub, trend, icon,
}: {
  label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral'; icon: React.ReactNode;
}) {
  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {sub && (
          <p className={`text-xs mt-1 ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>{sub}</p>
        )}
      </div>
    </Card>
  );
}

/* Icons */
function DollarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function TrendUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  );
}

/* Employee Detail Modal */
function EmployeeDetailModal({
  employee,
  scheduleId,
  onClose,
}: {
  employee: Employee;
  scheduleId: number;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployeeStats(employee.id, scheduleId)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [employee.id, scheduleId]);

  const shiftRows = stats?.shifts ?? [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8" onClick={e => e.target === e.currentTarget && onClose()}>
      <Card className="w-full max-w-2xl shadow-2xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">{employee.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{employee.role} · ${employee.hourly_rate}/hr · Max {employee.weekly_hours_max}h/wk</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors">
            <XIcon />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading…</div>
          ) : !stats ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">No data for this schedule.</div>
          ) : (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/40 p-3 text-center border border-border">
                  <p className="text-xs text-muted-foreground">Hours This Week</p>
                  <p className="text-xl font-bold text-foreground mt-1">{stats.weekly_hours}h</p>
                  <p className="text-xs text-muted-foreground">of {employee.weekly_hours_max}h max</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3 text-center border border-border">
                  <p className="text-xs text-muted-foreground">Labor Cost</p>
                  <p className="text-xl font-bold text-foreground mt-1">${stats.labor_cost.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">{stats.labor_pct_of_budget.toFixed(1)}% of budget</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3 text-center border border-border">
                  <p className="text-xs text-muted-foreground">Shifts</p>
                  <p className="text-xl font-bold text-foreground mt-1">{shiftRows.length}</p>
                  <p className="text-xs text-muted-foreground">this week</p>
                </div>
              </div>

              <div className="flex gap-3">
                {stats.burnout && (
                  <div className="flex-1 rounded-xl border border-border p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">Burnout Risk</p>
                      <Badge variant={riskVariant(stats.burnout.risk_level)}>{stats.burnout.risk_level}</Badge>
                    </div>
                    {stats.burnout.factors.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1.5">{stats.burnout.factors.join(' · ')}</p>
                    )}
                  </div>
                )}
                {stats.turnover && (
                  <div className="flex-1 rounded-xl border border-border p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">Turnover Risk</p>
                      <Badge variant={riskVariant(stats.turnover.risk_level)}>{stats.turnover.risk_level}</Badge>
                    </div>
                    {stats.turnover.factors.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1.5">{stats.turnover.factors.join(' · ')}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Labor cost as % of budget</span>
                  <span className="font-semibold">{stats.labor_pct_of_budget.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stats.labor_pct_of_budget > 25 ? 'bg-red-500' : stats.labor_pct_of_budget > 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, stats.labor_pct_of_budget * 4)}%` }}
                  />
                </div>
              </div>

              {shiftRows.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Schedule This Week</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {shiftRows.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs border border-border">
                        <span className="font-medium text-foreground">{new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <span className="text-muted-foreground">{s.start_time}–{s.end_time}</span>
                        <span className="font-semibold">{shiftHours(s.start_time, s.end_time).toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isManager = user?.isManager ?? false;

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [laborCost, setLaborCost] = useState<LaborCostSummary | null>(null);
  const [burnout, setBurnout] = useState<BurnoutRisk[]>([]);
  const [turnover, setTurnover] = useState<TurnoverRisk[]>([]);
  const [staffingSuggestions, setStaffingSuggestions] = useState<DailyStaffingSuggestion[]>([]);
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    Promise.all([
      getSchedules(),
      getEmployees().catch(() => [] as Employee[]),
    ]).then(([s, e]) => {
      setSchedules(s);
      setEmployees(e);
      if (s.length > 0) setSelectedId(s[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (isManager) {
      getLaborCost(selectedId).then(setLaborCost).catch(() => setLaborCost(null));
      getTurnoverRisks(selectedId).then(setTurnover).catch(() => setTurnover([]));
    }
    getBurnoutRisks(selectedId).then(setBurnout).catch(() => setBurnout([]));
    getScheduleShifts(selectedId).then(setShifts).catch(() => setShifts([]));
  }, [selectedId, isManager]);

  useEffect(() => {
    if (!isManager) return;
    const schedule = schedules.find(s => s.id === selectedId);
    if (!schedule) return;
    getStaffingSuggestions(schedule.week_start)
      .then(setStaffingSuggestions)
      .catch(() => setStaffingSuggestions([]));
  }, [selectedId, schedules, isManager]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading dashboard…
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
        </div>
        <p className="text-foreground font-semibold">No schedules yet</p>
        <p className="text-sm text-muted-foreground">Go to the Schedule tab to generate your first schedule.</p>
      </div>
    );
  }

  const highRisk = burnout.filter(b => b.risk_level === 'high');
  const mediumRisk = burnout.filter(b => b.risk_level === 'medium');
  const budgetPct = laborCost ? (laborCost.projected_cost / laborCost.labor_budget) * 100 : 0;
  const overBudget = laborCost && laborCost.variance > 0;

  /* Derived analytics */

  const employeeHoursMap: Record<number, number> = {};
  for (const s of shifts) {
    employeeHoursMap[s.employee_id] = (employeeHoursMap[s.employee_id] ?? 0) + shiftHours(s.start_time, s.end_time);
  }
  const hoursPerEmployee = employees.map(e => ({
    name: e.name.split(' ')[0],
    hours: Math.round((employeeHoursMap[e.id] ?? 0) * 10) / 10,
    max: e.weekly_hours_max,
    pct: Math.min(100, Math.round(((employeeHoursMap[e.id] ?? 0) / e.weekly_hours_max) * 100)),
  })).filter(e => e.hours > 0);

  const laborVsTarget = (laborCost?.by_day ?? []).map(d => ({
    date: d.date.slice(5),
    cost: d.cost,
    budget: Math.round(laborCost!.labor_budget / 7),
    pct: Math.round((d.cost / (laborCost!.labor_budget / 7)) * 100),
  }));

  const shiftCountByEmployee = employees.map(e => ({
    name: e.name.split(' ')[0],
    shifts: shifts.filter(s => s.employee_id === e.id).length,
  })).filter(e => e.shifts > 0);

  const alerts: { type: string; message: string; level: 'high' | 'medium' | 'low' }[] = [];
  for (const b of burnout) {
    const emp = employees.find(e => e.id === b.employee_id);
    if (!emp) continue;
    if (b.weekly_hours > emp.weekly_hours_max) {
      alerts.push({ type: 'Exceeding Hours', message: `${b.employee_name} is scheduled ${b.weekly_hours}h (max ${emp.weekly_hours_max}h)`, level: 'high' });
    }
    if (b.clopens > 0) {
      alerts.push({ type: 'Clopen Warning', message: `${b.employee_name} has ${b.clopens} clopen shift${b.clopens > 1 ? 's' : ''}`, level: 'medium' });
    }
    if (b.consecutive_days >= 5) {
      alerts.push({ type: 'Back-to-Back Shifts', message: `${b.employee_name} works ${b.consecutive_days} consecutive days`, level: 'medium' });
    }
    if (b.doubles > 0) {
      alerts.push({ type: 'Double Shifts', message: `${b.employee_name} has ${b.doubles} double shift${b.doubles > 1 ? 's' : ''}`, level: 'medium' });
    }
  }

  const employeeEfficiency = employees.map(e => ({
    name: e.name.split(' ')[0],
    efficiency: Math.min(100, Math.round(((employeeHoursMap[e.id] ?? 0) / e.weekly_hours_max) * 100)),
    avgWorkload: Math.round((employeeHoursMap[e.id] ?? 0) * 10) / 10,
  })).filter(e => e.avgWorkload > 0);

  const estRevenue = staffingSuggestions.reduce((s, d) => s + d.expected_revenue, 0);
  const estLaborCost = laborCost?.projected_cost ?? 0;
  const estExpenses = Math.round(estLaborCost * 1.3);
  const estProfit = estRevenue - estExpenses;
  const laborRevenuePct = estRevenue > 0 ? (estLaborCost / estRevenue) * 100 : 0;

  const burnoutDistribution = [
    { name: 'High', value: burnout.filter(b => b.risk_level === 'high').length, fill: '#ef4444' },
    { name: 'Medium', value: burnout.filter(b => b.risk_level === 'medium').length, fill: '#f59e0b' },
    { name: 'Low', value: burnout.filter(b => b.risk_level === 'low').length, fill: '#10b981' },
  ].filter(d => d.value > 0);

  const turnoverDistribution = [
    { name: 'High', value: turnover.filter(t => t.risk_level === 'high').length, fill: '#ef4444' },
    { name: 'Medium', value: turnover.filter(t => t.risk_level === 'medium').length, fill: '#f59e0b' },
    { name: 'Low', value: turnover.filter(t => t.risk_level === 'low').length, fill: '#10b981' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Weekly overview and insights</p>
        </div>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isManager && (
          <KpiCard
            label="Projected Labor Cost"
            value={laborCost ? `$${laborCost.projected_cost.toLocaleString()}` : '—'}
            sub={laborCost ? `Budget $${laborCost.labor_budget.toLocaleString()}` : ''}
            trend={overBudget ? 'down' : 'up'}
            icon={<DollarIcon />}
          />
        )}
        {isManager && (
          <KpiCard
            label="Budget Usage"
            value={laborCost ? `${budgetPct.toFixed(1)}%` : '—'}
            sub={overBudget
              ? `$${Math.abs(laborCost!.variance).toFixed(0)} over budget`
              : laborCost ? `$${Math.abs(laborCost.variance).toFixed(0)} under budget` : ''}
            trend={budgetPct > 100 ? 'down' : budgetPct > 90 ? 'neutral' : 'up'}
            icon={<ChartIcon />}
          />
        )}
        <KpiCard
          label="High Burnout Risk"
          value={highRisk.length.toString()}
          sub={highRisk.length > 0 ? highRisk.map(b => b.employee_name.split(' ')[0]).join(', ') : 'All clear'}
          trend={highRisk.length > 0 ? 'down' : 'up'}
          icon={<AlertIcon />}
        />
        <KpiCard
          label="Medium Risk"
          value={mediumRisk.length.toString()}
          sub="employees need attention"
          trend={mediumRisk.length > 2 ? 'down' : 'neutral'}
          icon={<UsersIcon />}
        />
        {isManager && estRevenue > 0 && (
          <KpiCard
            label="Est. Revenue (Sales Goal)"
            value={`$${estRevenue.toLocaleString()}`}
            sub="based on forecasts"
            trend="neutral"
            icon={<TrendUpIcon />}
          />
        )}
        {isManager && estRevenue > 0 && (
          <KpiCard
            label="Est. Expenses"
            value={`$${estExpenses.toLocaleString()}`}
            sub={`Labor $${estLaborCost.toFixed(0)} + overhead`}
            trend="neutral"
            icon={<DollarIcon />}
          />
        )}
        {isManager && estRevenue > 0 && (
          <KpiCard
            label="Est. Profit"
            value={estProfit > 0 ? `$${estProfit.toLocaleString()}` : `-$${Math.abs(estProfit).toLocaleString()}`}
            sub="Revenue minus expenses"
            trend={estProfit > 0 ? 'up' : 'down'}
            icon={<DollarIcon />}
          />
        )}
        {isManager && estRevenue > 0 && (
          <KpiCard
            label="Labor % of Revenue"
            value={`${laborRevenuePct.toFixed(1)}%`}
            sub={laborRevenuePct > 35 ? 'Above 35% target' : 'Within target'}
            trend={laborRevenuePct > 35 ? 'down' : 'up'}
            icon={<ChartIcon />}
          />
        )}
        {isManager && (
          <KpiCard
            label="High Turnover Risk"
            value={turnover.filter(t => t.risk_level === 'high').length.toString()}
            sub={turnover.filter(t => t.risk_level === 'high').length > 0 ? 'Needs attention' : 'Team stable'}
            trend={turnover.filter(t => t.risk_level === 'high').length > 0 ? 'down' : 'up'}
            icon={<UsersIcon />}
          />
        )}
      </div>

      {/* Alerts */}
      {isManager && alerts.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertIcon />
            <h2 className="text-sm font-semibold text-foreground">Alerts</h2>
            <Badge variant="danger" className="text-xs">{alerts.length}</Badge>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <span
                  className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: RISK_COLORS[a.level] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{a.type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                </div>
                <Badge variant={riskVariant(a.level)} className="shrink-0 text-xs">{a.level}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Labor % vs Target + Hours per Employee */}
      {isManager && (
        <div className="grid md:grid-cols-2 gap-4">
          {laborVsTarget.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Labor % vs Target</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={laborVsTarget} barSize={18} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`$${(v as number).toFixed(2)}`, name === 'cost' ? 'Actual Cost' : 'Daily Budget']}
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="cost" name="Actual Cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="budget" name="Daily Budget" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {hoursPerEmployee.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Hours per Employee</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hoursPerEmployee} layout="vertical" barSize={14}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v: number) => [`${v}h`, 'Hours']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                    {hoursPerEmployee.map((e, i) => (
                      <Cell key={i} fill={e.pct >= 95 ? '#ef4444' : e.pct >= 80 ? '#f59e0b' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* Employee Avg Workload & Efficiency */}
      {isManager && employeeEfficiency.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Employee Average Workload</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={employeeEfficiency} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}h`} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v: number) => [`${v}h`, 'Hours']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="avgWorkload" name="Hours" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">Employee Efficiency</h2>
            <p className="text-xs text-muted-foreground mb-3">Hours worked as % of weekly maximum</p>
            <ResponsiveContainer width="100%" height={185}>
              <BarChart data={employeeEfficiency} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Utilization']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="efficiency" name="Efficiency" radius={[6, 6, 0, 0]}>
                  {employeeEfficiency.map((e, i) => (
                    <Cell key={i} fill={e.efficiency >= 95 ? '#ef4444' : e.efficiency >= 75 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Productivity Chart */}
      {isManager && laborVsTarget.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Productivity Chart – Labor Cost Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={laborVsTarget}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={55} />
              <Tooltip
                formatter={(v: number, name: string) => [`$${(v as number).toFixed(2)}`, name === 'cost' ? 'Labor Cost' : 'Budget/Day']}
                contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="cost" name="Labor Cost" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="budget" name="Budget/Day" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Shift Distribution Fairness */}
      {isManager && shiftCountByEmployee.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Shift Distribution Fairness</h2>
          <p className="text-xs text-muted-foreground mb-4">Number of shifts assigned per employee this week</p>
          <div className="space-y-2.5">
            {shiftCountByEmployee.sort((a, b) => b.shifts - a.shifts).map((e, i) => {
              const maxShifts = Math.max(...shiftCountByEmployee.map(x => x.shifts));
              const pct = Math.round((e.shifts / maxShifts) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-foreground font-medium w-24 shrink-0 truncate">{e.name}</span>
                  <div className="flex-1 bg-muted/50 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-14 text-right">{e.shifts} shifts</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Labor Cost & Burnout Analytics + Turnover Risk */}
      {isManager && (
        <div className="grid md:grid-cols-2 gap-4">
          {burnoutDistribution.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Labor Cost &amp; Burnout Analytics</h2>
              <div className="flex items-center gap-6">
                <PieChart width={120} height={120}>
                  <Pie data={burnoutDistribution} dataKey="value" cx={55} cy={55} outerRadius={50} innerRadius={28}>
                    {burnoutDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, `${name} Risk`]} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
                <div className="flex-1 space-y-2">
                  {burnoutDistribution.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-xs text-foreground">{d.name} Risk</span>
                      <span className="text-xs font-bold text-foreground ml-auto">{d.value}</span>
                    </div>
                  ))}
                  {laborCost && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">Total Labor Cost</p>
                      <p className="text-sm font-bold text-foreground">${laborCost.projected_cost.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">vs ${laborCost.labor_budget.toFixed(0)} budget</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {turnoverDistribution.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Turnover Risk</h2>
              <div className="flex items-center gap-6">
                <PieChart width={120} height={120}>
                  <Pie data={turnoverDistribution} dataKey="value" cx={55} cy={55} outerRadius={50} innerRadius={28}>
                    {turnoverDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, `${name} Risk`]} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
                <div className="flex-1 space-y-2">
                  {turnoverDistribution.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-xs text-foreground">{d.name} Risk</span>
                      <span className="text-xs font-bold text-foreground ml-auto">{d.value}</span>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Employees at risk</p>
                    <p className="text-sm font-bold text-foreground">
                      {turnover.filter(t => t.risk_level !== 'low').length} of {turnover.length}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Daily Labor Cost Chart */}
      {isManager && laborCost && laborCost.by_day.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Daily Labor Cost</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={laborCost.by_day} barSize={28}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={50} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']} labelFormatter={l => `Date: ${l}`} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                {laborCost.by_day.map((_, i) => <Cell key={i} fill="#6366f1" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Cost by Role + Burnout side-by-side */}
      <div className="grid md:grid-cols-2 gap-4">
        {isManager && laborCost && laborCost.by_role.length > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Cost by Role</h2>
            <div className="space-y-3">
              {laborCost.by_role.map(r => (
                <div key={r.role} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{r.role}</span>
                  <div className="flex-1 bg-muted/50 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, (r.cost / laborCost.projected_cost) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-14 text-right">${r.cost.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Burnout Risk Monitor</h2>
          {burnout.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/>
              </svg>
              <p className="text-sm">No burnout risks detected</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {burnout.map(b => (
                <div key={b.employee_id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                  <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: RISK_COLORS[b.risk_level] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{b.employee_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{b.weekly_hours}h/wk</span>
                    </div>
                    {b.factors.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.factors.join(' · ')}</p>
                    )}
                    {b.rest_days_recommended > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        {b.rest_days_recommended} rest day{b.rest_days_recommended > 1 ? 's' : ''} recommended
                      </p>
                    )}
                  </div>
                  <Badge variant={riskVariant(b.risk_level)} className="shrink-0">{b.risk_level}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Employee Overview – click for individual stats */}
      {isManager && employees.length > 0 && selectedId && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Employee Overview</h2>
          <p className="text-xs text-muted-foreground mb-4">Click an employee to view their stats, schedule, labor cost, burnout &amp; turnover risk.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map(emp => {
              const hours = employeeHoursMap[emp.id] ?? 0;
              const utilPct = Math.min(100, Math.round((hours / emp.weekly_hours_max) * 100));
              const burnoutInfo = burnout.find(b => b.employee_id === emp.id);
              const turnoverInfo = turnover.find(t => t.employee_id === emp.id);
              const rankOf = (lvl: string | undefined) => lvl ? ({ high: 2, medium: 1, low: 0 } as Record<string, number>)[lvl] ?? -1 : -1;
              const worstLevel = rankOf(burnoutInfo?.risk_level) >= rankOf(turnoverInfo?.risk_level)
                ? burnoutInfo?.risk_level
                : turnoverInfo?.risk_level;

              return (
                <button
                  key={emp.id}
                  className="text-left rounded-xl border border-border p-3 bg-background/40 hover:bg-muted/50 transition-colors cursor-pointer w-full"
                  onClick={() => setSelectedEmployee(emp)}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-foreground truncate">{emp.name}</p>
                    {worstLevel && <Badge variant={riskVariant(worstLevel)} className="text-xs">{worstLevel}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{emp.role} · ${emp.hourly_rate}/hr</p>
                  <div className="flex items-center justify-between text-xs mt-2">
                    <span className="text-muted-foreground">Hours</span>
                    <span className="font-medium">{hours.toFixed(1)} / {emp.weekly_hours_max}h</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${utilPct >= 95 ? 'bg-red-500' : utilPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${utilPct}%` }}
                    />
                  </div>
                  {burnoutInfo && (
                    <p className="text-xs text-muted-foreground mt-1.5">Burnout: <span className="font-semibold" style={{ color: RISK_COLORS[burnoutInfo.risk_level] }}>{burnoutInfo.risk_level}</span></p>
                  )}
                  {turnoverInfo && (
                    <p className="text-xs text-muted-foreground">Turnover: <span className="font-semibold" style={{ color: RISK_COLORS[turnoverInfo.risk_level] }}>{turnoverInfo.risk_level}</span></p>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Demand-Based Staffing */}
      {isManager && staffingSuggestions.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Demand-Based Staffing</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Recommended staff count per day based on forecast revenue</p>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {staffingSuggestions.map(day => {
              const totalStaff = day.staffing.reduce((sum, s) => sum + s.count, 0);
              const roleGroups: Record<string, number> = {};
              for (const s of day.staffing) roleGroups[s.role] = (roleGroups[s.role] || 0) + s.count;
              return (
                <div key={day.date} className="bg-muted/40 rounded-xl p-3 text-center border border-border">
                  <div className="text-xs font-semibold text-muted-foreground">{DAY_NAMES[day.day_of_week]}</div>
                  <div className="text-xs text-muted-foreground/70 mb-1">{day.date.slice(5)}</div>
                  <div className="text-xl font-bold text-primary">{totalStaff}</div>
                  <div className="text-xs text-muted-foreground">staff</div>
                  {day.expected_revenue > 0 && (
                    <div className="text-xs text-muted-foreground mt-1 font-medium">${(day.expected_revenue / 1000).toFixed(1)}k</div>
                  )}
                  <div className="mt-2 space-y-0.5">
                    {Object.entries(roleGroups).map(([role, count]) => (
                      <div key={role} className="text-[10px] text-muted-foreground">{count} {role}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Employee Detail Modal */}
      {selectedEmployee && selectedId && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          scheduleId={selectedId}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
