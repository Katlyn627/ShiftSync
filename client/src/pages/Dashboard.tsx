import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  getSchedules, getLaborCost, getBurnoutRisks, getStaffingSuggestions,
  Schedule, LaborCostSummary, BurnoutRisk, DailyStaffingSuggestion
} from '../api';
import { useAuth } from '../AuthContext';
import { Card, Badge, NATIVE_SELECT_CLASS } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

const RISK_COLORS: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#10b981',
};

function riskVariant(level: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = { high: 'danger', medium: 'warning', low: 'success' };
  return map[level] ?? 'default';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── KPI Card ── */
function KpiCard({
  label, value, sub, trend, icon,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {sub && (
          <p className={`text-xs mt-1 ${
            trend === 'up'   ? 'text-emerald-600' :
            trend === 'down' ? 'text-red-500'     : 'text-muted-foreground'
          }`}>{sub}</p>
        )}
      </div>
    </Card>
  );
}

/* ── Inline SVG icons ── */
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

export default function Dashboard() {
  const { user } = useAuth();
  const isManager = user?.isManager ?? false;
  const [schedules, setSchedules]                   = useState<Schedule[]>([]);
  const [selectedId, setSelectedId]                 = useState<number | null>(null);
  const [laborCost, setLaborCost]                   = useState<LaborCostSummary | null>(null);
  const [burnout, setBurnout]                       = useState<BurnoutRisk[]>([]);
  const [staffingSuggestions, setStaffingSuggestions] = useState<DailyStaffingSuggestion[]>([]);
  const [loading, setLoading]                       = useState(true);

  useEffect(() => {
    getSchedules().then(s => {
      setSchedules(s);
      if (s.length > 0) setSelectedId(s[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (isManager) getLaborCost(selectedId).then(setLaborCost).catch(() => setLaborCost(null));
    getBurnoutRisks(selectedId).then(setBurnout).catch(() => setBurnout([]));
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

  const highRisk   = burnout.filter(b => b.risk_level === 'high');
  const mediumRisk = burnout.filter(b => b.risk_level === 'medium');
  const budgetPct  = laborCost ? (laborCost.projected_cost / laborCost.labor_budget) * 100 : 0;
  const overBudget = laborCost && laborCost.variance > 0;

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
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
            <option key={s.id} value={s.id}>
              Week of {s.week_start} ({s.status})
            </option>
          ))}
        </select>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isManager && (
          <KpiCard
            label="Projected Cost"
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
      </div>

      {/* ── Staffing Suggestions ── */}
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

      {/* ── Labor Cost Chart ── */}
      {isManager && laborCost && laborCost.by_day.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Daily Labor Cost</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={laborCost.by_day} barSize={28}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']}
                labelFormatter={l => `Date: ${l}`}
                contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                {laborCost.by_day.map((_, i) => <Cell key={i} fill="#6366f1" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Cost by Role + Burnout side-by-side ── */}
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
                  <span
                    className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: RISK_COLORS[b.risk_level] }}
                  />
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

    </div>
  );
}
