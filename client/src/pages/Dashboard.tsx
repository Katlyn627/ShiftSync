import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  getSchedules, getLaborCost, getBurnoutRisks, getStaffingSuggestions,
  getEmployees, getScheduleShifts, getAvailability, getEmployeeStats,
  Schedule, LaborCostSummary, BurnoutRisk, DailyStaffingSuggestion, Employee, ShiftWithEmployee, Availability, EmployeeStats
} from '../api';
import { useAuth } from '../AuthContext';
import { Card, Badge, Modal, NATIVE_SELECT_CLASS } from '../components/ui';
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

/* ── Employee avatar helpers (consistent with EmployeesPage) ── */
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_BG: Record<string, string> = {
  Manager: 'bg-violet-100 text-violet-700',
  Server:  'bg-blue-100 text-blue-700',
  Kitchen: 'bg-orange-100 text-orange-700',
  Bar:     'bg-emerald-100 text-emerald-700',
  Host:    'bg-pink-100 text-pink-700',
};

/* ── Shift duration helpers ── */
function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftHours(start: string, end: string): number {
  const startMin = parseMinutes(start);
  let endMin = parseMinutes(end);
  if (endMin < startMin) endMin += 24 * 60;
  return (endMin - startMin) / 60;
}

/* ── Role-to-badge-variant mapping (consistent with EmployeesPage) ── */
const ROLE_BADGE_VARIANT: Record<string, BadgeVariant> = {
  Manager: 'manager', Server: 'server', Kitchen: 'kitchen', Bar: 'bar', Host: 'host',
};

/* ── Employee shift cost / hours helpers ── */
function calculateEmployeeLaborCost(shifts: ShiftWithEmployee[]): number {
  return shifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time) * (s.hourly_rate ?? 0), 0);
}

function calculateTotalHours(shifts: ShiftWithEmployee[]): number {
  return shifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0);
}

/* ── Turnover risk derived from burnout ── */
function getTurnoverRisk(burnoutRisk: BurnoutRisk | undefined): { level: 'low' | 'medium' | 'high'; reason: string } {
  if (!burnoutRisk) return { level: 'low', reason: 'No schedule data for this week' };
  if (burnoutRisk.risk_level === 'high') return { level: 'high', reason: 'High burnout risk strongly correlates with turnover intent' };
  if (burnoutRisk.risk_level === 'medium') return { level: 'medium', reason: 'Moderate stress factors may affect long-term retention' };
  return { level: 'low', reason: 'Schedule conditions suggest stable retention' };
}

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

/* ── Employee Detail Modal ── */
function EmployeeDetailModal({
  emp, empShifts, selectedEmployeeStats, burnout, laborCost, employeeAvailability, onClose,
}: {
  emp: Employee;
  empShifts: ShiftWithEmployee[];
  selectedEmployeeStats: EmployeeStats | null;
  burnout: BurnoutRisk[];
  laborCost: LaborCostSummary | null;
  employeeAvailability: Availability[];
  onClose: () => void;
}) {
  const burnoutRisk    = burnout.find(b => b.employee_id === emp.id);
  const turnoverRisk   = getTurnoverRisk(burnoutRisk);
  const empCost        = Number(selectedEmployeeStats?.labor_cost ?? calculateEmployeeLaborCost(empShifts)) || 0;
  const totalHours     = Number(selectedEmployeeStats?.total_hours ?? calculateTotalHours(empShifts)) || 0;
  const overtimeHours  = Number(selectedEmployeeStats?.overtime_hours ?? Math.max(0, totalHours - 40)) || 0;
  const avgHoursPerShift = Number(selectedEmployeeStats?.avg_hours_per_shift ?? (empShifts.length > 0 ? totalHours / empShifts.length : 0)) || 0;
  const costPct        = laborCost && laborCost.projected_cost > 0 ? (empCost / laborCost.projected_cost) * 100 : 0;
  const hourlyRate     = Number(emp.hourly_rate) || 0;
  const weeklyHoursMax = Number(emp.weekly_hours_max) || 0;
  return (
    <Modal open onClose={onClose} title={emp.name} className="sm:max-w-2xl">
      <div className="space-y-5 text-foreground">

        {/* Profile */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${AVATAR_BG[emp.role] ?? 'bg-muted text-muted-foreground'}`}>
            {initials(emp.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-base">{emp.name}</span>
              <Badge variant={ROLE_BADGE_VARIANT[emp.role] ?? 'default'}>{emp.role}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
              <span>${hourlyRate.toFixed(2)}/hr</span>
              <span>Max {weeklyHoursMax}h/wk</span>
              {emp.email && <span>{emp.email}</span>}
              {emp.phone && <span>{emp.phone}</span>}
            </div>
          </div>
        </div>

        {/* This Week's Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Shifts</p>
            <p className="text-xl font-bold text-foreground">{empShifts.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Hours</p>
            <p className="text-xl font-bold text-foreground">{totalHours.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">of {weeklyHoursMax}h max</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Labor Cost</p>
            <p className="text-xl font-bold text-foreground">${empCost.toFixed(0)}</p>
            {costPct > 0 && <p className="text-[10px] text-muted-foreground">{costPct.toFixed(1)}% of total</p>}
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Overtime Hrs</p>
            <p className={`text-xl font-bold ${overtimeHours > 0 ? 'text-red-500' : 'text-foreground'}`}>
              {overtimeHours.toFixed(1)}
            </p>
            {overtimeHours > 0 && <p className="text-[10px] text-red-400">over 40h</p>}
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Avg Hrs/Shift</p>
            <p className="text-xl font-bold text-foreground">
              {avgHoursPerShift > 0 ? avgHoursPerShift.toFixed(1) : '—'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Remaining Hrs</p>
            <p className={`text-xl font-bold ${weeklyHoursMax - totalHours < 0 ? 'text-red-500' : 'text-foreground'}`}>
              {Math.max(0, weeklyHoursMax - totalHours).toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">of {weeklyHoursMax}h max</p>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">This Week's Schedule</h3>
          {empShifts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center bg-muted/20 rounded-xl border border-border">No shifts scheduled this week.</p>
          ) : (
            <div className="space-y-1.5">
              {empShifts.map(s => {
                const d = new Date(s.date + 'T00:00:00');
                const dayName = DAY_NAMES[d.getDay()];
                const hrs = shiftHours(s.start_time, s.end_time);
                const rate = Number(s.hourly_rate) || 0;
                return (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm">
                    <span className="w-10 text-xs font-semibold text-muted-foreground shrink-0">{dayName}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{s.date.slice(5)}</span>
                    <span className="font-medium text-foreground">{s.start_time} – {s.end_time}</span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">{hrs.toFixed(1)}h</span>
                    <span className="text-xs text-muted-foreground shrink-0">${(hrs * rate).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Burnout Risk */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Burnout Risk</h3>
          {!burnoutRisk ? (
            <p className="text-sm text-muted-foreground py-3 text-center bg-muted/20 rounded-xl border border-border">No burnout data for this schedule.</p>
          ) : (
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Risk Level</span>
                <Badge variant={riskVariant(burnoutRisk.risk_level)}>{burnoutRisk.risk_level}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Score:</span>
                <div className="flex-1 bg-muted/50 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: `${burnoutRisk.risk_score}%`, backgroundColor: RISK_COLORS[burnoutRisk.risk_level] }}
                  />
                </div>
                <span className="text-xs font-semibold text-foreground">{burnoutRisk.risk_score}/100</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>Consecutive days: {burnoutRisk.consecutive_days}</span>
                <span>Clopens: {burnoutRisk.clopens}</span>
                <span>Doubles: {burnoutRisk.doubles}</span>
                <span>Late-night shifts: {burnoutRisk.late_night_shifts}</span>
              </div>
              {burnoutRisk.factors.length > 0 && (
                <p className="text-xs text-muted-foreground">{burnoutRisk.factors.join(' · ')}</p>
              )}
              {burnoutRisk.rest_days_recommended > 0 && (
                <p className="text-xs font-medium text-amber-600">
                  {burnoutRisk.rest_days_recommended} rest day{burnoutRisk.rest_days_recommended > 1 ? 's' : ''} recommended
                </p>
              )}
            </div>
          )}
        </div>

        {/* Turnover Risk */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Turnover Risk</h3>
          <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-start gap-3">
            <span
              className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: RISK_COLORS[turnoverRisk.level] }}
            />
            <div>
              <span className="text-sm font-medium capitalize">{turnoverRisk.level} risk</span>
              <p className="text-xs text-muted-foreground mt-0.5">{turnoverRisk.reason}</p>
            </div>
            <Badge variant={riskVariant(turnoverRisk.level)} className="ml-auto shrink-0">{turnoverRisk.level}</Badge>
          </div>
        </div>

        {/* Availability */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Availability</h3>
          {employeeAvailability.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center bg-muted/20 rounded-xl border border-border">No availability set for this employee.</p>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_NAMES.map((dayName, i) => {
                const avail = employeeAvailability.find(a => a.day_of_week === i);
                return (
                  <div
                    key={i}
                    className={`rounded-lg p-2 text-center border ${avail ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-muted/20 border-border'}`}
                  >
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">{dayName}</p>
                    {avail ? (
                      <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 leading-tight">
                        {avail.start_time.slice(0, 5)}<br />–<br />{avail.end_time.slice(0, 5)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/60">Off</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </Modal>
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
  const [employees, setEmployees]                   = useState<Employee[]>([]);
  const [scheduleShifts, setScheduleShifts]         = useState<ShiftWithEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee]     = useState<Employee | null>(null);
  const [employeeAvailability, setEmployeeAvailability] = useState<Availability[]>([]);
  const [selectedEmployeeStats, setSelectedEmployeeStats] = useState<EmployeeStats | null>(null);

  useEffect(() => {
    getSchedules().then(s => {
      setSchedules(s);
      if (s.length > 0) setSelectedId(s[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
    getEmployees().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    if (!selectedEmployee) { setEmployeeAvailability([]); setSelectedEmployeeStats(null); return; }
    setSelectedEmployeeStats(null);
    getAvailability(selectedEmployee.id).then(setEmployeeAvailability).catch(() => setEmployeeAvailability([]));
    if (selectedId) {
      getEmployeeStats(selectedEmployee.id, selectedId)
        .then(setSelectedEmployeeStats)
        .catch(() => setSelectedEmployeeStats(null));
    }
  }, [selectedEmployee, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (isManager) getLaborCost(selectedId).then(setLaborCost).catch(() => setLaborCost(null));
    getBurnoutRisks(selectedId).then(setBurnout).catch(() => setBurnout([]));
    getScheduleShifts(selectedId).then(setScheduleShifts).catch(() => setScheduleShifts([]));
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

      {/* ── Employee Overview ── */}
      {isManager && employees.length > 0 && (
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Employee Overview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Click an employee to view their stats, schedule, labor cost, burnout &amp; turnover risk.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {employees.map(emp => {
              const burnoutRisk = burnout.find(b => b.employee_id === emp.id);
              const empShifts   = scheduleShifts.filter(s => s.employee_id === emp.id);
              const empCost     = calculateEmployeeLaborCost(empShifts);
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border hover:bg-muted/60 hover:border-primary/30 transition-all cursor-pointer text-center w-full"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${AVATAR_BG[emp.role] ?? 'bg-muted text-muted-foreground'}`}>
                    {initials(emp.name)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{emp.name}</p>
                    <p className="text-[10px] text-muted-foreground">{emp.role}</p>
                    {empShifts.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">${empCost.toFixed(0)} this week</p>
                    )}
                  </div>
                  {burnoutRisk && burnoutRisk.risk_level !== 'low' && (
                    <Badge variant={riskVariant(burnoutRisk.risk_level)} className="text-[10px] px-1.5 py-0.5">
                      {burnoutRisk.risk_level} risk
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Employee Detail Modal ── */}
      {selectedEmployee && (
        <EmployeeDetailModal
          emp={selectedEmployee}
          empShifts={scheduleShifts.filter(s => s.employee_id === selectedEmployee.id).sort((a, b) => a.date.localeCompare(b.date))}
          selectedEmployeeStats={selectedEmployeeStats}
          burnout={burnout}
          laborCost={laborCost}
          employeeAvailability={employeeAvailability}
          onClose={() => setSelectedEmployee(null)}
        />
      )}

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
