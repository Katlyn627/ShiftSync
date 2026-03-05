import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend, PieChart, Pie, } from 'recharts';
import { getSchedules, getLaborCost, getBurnoutRisks, getStaffingSuggestions, getEmployees, getScheduleShifts, getTurnoverRisks, getEmployeeStats, } from '../api';
import { useAuth } from '../AuthContext';
import { Card, Badge, NATIVE_SELECT_CLASS } from '../components/ui';
const RISK_COLORS = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981',
};
function riskVariant(level) {
    const map = { high: 'danger', medium: 'warning', low: 'success' };
    return map[level] ?? 'default';
}
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RISK_RANK = { high: 2, medium: 1, low: 0 };
function rankRiskLevel(lvl) {
    return lvl !== undefined ? (RISK_RANK[lvl] ?? -1) : -1;
}
function toMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
function shiftHours(start, end) {
    const s = toMinutes(start);
    let e = toMinutes(end);
    if (e < s)
        e += 24 * 60;
    return (e - s) / 60;
}
/** Parse a YYYY-MM-DD date string safely (noon UTC to avoid timezone shifts) */
function formatShiftDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        const dt = new Date(y, m - 1, d);
        return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return dateStr;
}
/* KPI Card */
function KpiCard({ label, value, sub, trend, icon, }) {
    return (_jsxs(Card, { className: "p-5 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: label }), _jsx("div", { className: "w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary", children: icon })] }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-foreground leading-none", children: value }), sub && (_jsx("p", { className: `text-xs mt-1 ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`, children: sub }))] })] }));
}
/* Icons */
function DollarIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", children: [_jsx("line", { x1: "12", y1: "1", x2: "12", y2: "23" }), _jsx("path", { d: "M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" })] }));
}
function ChartIcon() {
    return (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", children: _jsx("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" }) }));
}
function AlertIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", children: [_jsx("path", { d: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" }), _jsx("line", { x1: "12", y1: "9", x2: "12", y2: "13" }), _jsx("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })] }));
}
function UsersIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", children: [_jsx("path", { d: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" }), _jsx("circle", { cx: "9", cy: "7", r: "4" }), _jsx("path", { d: "M23 21v-2a4 4 0 00-3-3.87" }), _jsx("path", { d: "M16 3.13a4 4 0 010 7.75" })] }));
}
function TrendUpIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", children: [_jsx("polyline", { points: "23 6 13.5 15.5 8.5 10.5 1 18" }), _jsx("polyline", { points: "17 6 23 6 23 12" })] }));
}
function XIcon() {
    return (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: "2", viewBox: "0 0 24 24", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }));
}
/* Employee Detail Modal */
function EmployeeDetailModal({ employee, scheduleId, onClose, }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        getEmployeeStats(employee.id, scheduleId)
            .then(setStats)
            .catch(() => setStats(null))
            .finally(() => setLoading(false));
    }, [employee.id, scheduleId]);
    const shiftRows = stats?.shifts ?? [];
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8", onClick: e => e.target === e.currentTarget && onClose(), children: _jsxs(Card, { className: "w-full max-w-2xl shadow-2xl overflow-hidden p-0 max-h-[90vh] flex flex-col", children: [_jsxs("div", { className: "px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-foreground", children: employee.name }), _jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [employee.role, " \u00B7 $", employee.hourly_rate, "/hr \u00B7 Max ", employee.weekly_hours_max, "h/wk"] })] }), _jsx("button", { onClick: onClose, className: "w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors", children: _jsx(XIcon, {}) })] }), _jsx("div", { className: "overflow-y-auto flex-1", children: loading ? (_jsx("div", { className: "flex items-center justify-center py-16 text-muted-foreground text-sm", children: "Loading\u2026" })) : !stats ? (_jsx("div", { className: "flex items-center justify-center py-16 text-muted-foreground text-sm", children: "No data for this schedule." })) : (_jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "rounded-xl bg-muted/40 p-3 text-center border border-border", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Hours This Week" }), _jsxs("p", { className: "text-xl font-bold text-foreground mt-1", children: [stats.weekly_hours, "h"] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["of ", employee.weekly_hours_max, "h max"] })] }), _jsxs("div", { className: "rounded-xl bg-muted/40 p-3 text-center border border-border", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Labor Cost" }), _jsxs("p", { className: "text-xl font-bold text-foreground mt-1", children: ["$", stats.labor_cost.toFixed(0)] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [stats.labor_pct_of_budget.toFixed(1), "% of budget"] })] }), _jsxs("div", { className: "rounded-xl bg-muted/40 p-3 text-center border border-border", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Shifts" }), _jsx("p", { className: "text-xl font-bold text-foreground mt-1", children: shiftRows.length }), _jsx("p", { className: "text-xs text-muted-foreground", children: "this week" })] })] }), _jsxs("div", { className: "flex gap-3", children: [stats.burnout && (_jsxs("div", { className: "flex-1 rounded-xl border border-border p-3 bg-muted/20", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-semibold text-foreground", children: "Burnout Risk" }), _jsx(Badge, { variant: riskVariant(stats.burnout.risk_level), children: stats.burnout.risk_level })] }), stats.burnout.factors.length > 0 && (_jsx("p", { className: "text-xs text-muted-foreground mt-1.5", children: stats.burnout.factors.join(' · ') }))] })), stats.turnover && (_jsxs("div", { className: "flex-1 rounded-xl border border-border p-3 bg-muted/20", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-semibold text-foreground", children: "Turnover Risk" }), _jsx(Badge, { variant: riskVariant(stats.turnover.risk_level), children: stats.turnover.risk_level })] }), stats.turnover.factors.length > 0 && (_jsx("p", { className: "text-xs text-muted-foreground mt-1.5", children: stats.turnover.factors.join(' · ') }))] }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-xs text-muted-foreground mb-1", children: [_jsx("span", { children: "Labor cost as % of budget" }), _jsxs("span", { className: "font-semibold", children: [stats.labor_pct_of_budget.toFixed(1), "%"] })] }), _jsx("div", { className: "h-2 bg-muted rounded-full overflow-hidden", children: _jsx("div", { className: `h-full rounded-full ${stats.labor_pct_of_budget > 25 ? 'bg-red-500' : stats.labor_pct_of_budget > 15 ? 'bg-amber-500' : 'bg-emerald-500'}`, style: { width: `${Math.min(100, stats.labor_pct_of_budget * 4)}%` } }) })] }), shiftRows.length > 0 && (_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground mb-2", children: "Schedule This Week" }), _jsx("div", { className: "space-y-1.5 max-h-48 overflow-y-auto", children: shiftRows.map(s => (_jsxs("div", { className: "flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs border border-border", children: [_jsx("span", { className: "font-medium text-foreground", children: formatShiftDate(s.date) }), _jsxs("span", { className: "text-muted-foreground", children: [s.start_time, "\u2013", s.end_time] }), _jsxs("span", { className: "font-semibold", children: [shiftHours(s.start_time, s.end_time).toFixed(1), "h"] })] }, s.id))) })] }))] })) })] }) }));
}
export default function Dashboard() {
    const { user } = useAuth();
    const isManager = user?.isManager ?? false;
    const [schedules, setSchedules] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [laborCost, setLaborCost] = useState(null);
    const [burnout, setBurnout] = useState([]);
    const [turnover, setTurnover] = useState([]);
    const [staffingSuggestions, setStaffingSuggestions] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    useEffect(() => {
        Promise.all([
            getSchedules(),
            getEmployees().catch(() => []),
        ]).then(([s, e]) => {
            setSchedules(s);
            setEmployees(e);
            if (s.length > 0)
                setSelectedId(s[0].id);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);
    useEffect(() => {
        if (!selectedId)
            return;
        if (isManager) {
            getLaborCost(selectedId).then(setLaborCost).catch(() => setLaborCost(null));
            getTurnoverRisks(selectedId).then(setTurnover).catch(() => setTurnover([]));
        }
        getBurnoutRisks(selectedId).then(setBurnout).catch(() => setBurnout([]));
        getScheduleShifts(selectedId).then(setShifts).catch(() => setShifts([]));
    }, [selectedId, isManager]);
    useEffect(() => {
        if (!isManager)
            return;
        const schedule = schedules.find(s => s.id === selectedId);
        if (!schedule)
            return;
        getStaffingSuggestions(schedule.week_start)
            .then(setStaffingSuggestions)
            .catch(() => setStaffingSuggestions([]));
    }, [selectedId, schedules, isManager]);
    if (loading) {
        return (_jsxs("div", { className: "flex items-center justify-center py-24 text-muted-foreground text-sm", children: [_jsxs("svg", { className: "w-4 h-4 animate-spin mr-2", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8v8z" })] }), "Loading dashboard\u2026"] }));
    }
    if (schedules.length === 0) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center py-24 gap-2", children: [_jsx("div", { className: "w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground", children: _jsxs("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", strokeWidth: "1.5", viewBox: "0 0 24 24", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), _jsx("path", { d: "M16 2v4M8 2v4M3 10h18" })] }) }), _jsx("p", { className: "text-foreground font-semibold", children: "No schedules yet" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Go to the Schedule tab to generate your first schedule." })] }));
    }
    const highRisk = burnout.filter(b => b.risk_level === 'high');
    const mediumRisk = burnout.filter(b => b.risk_level === 'medium');
    const budgetPct = laborCost ? (laborCost.projected_cost / laborCost.labor_budget) * 100 : 0;
    const overBudget = laborCost && laborCost.variance > 0;
    /* Derived analytics */
    const employeeHoursMap = {};
    for (const s of shifts) {
        employeeHoursMap[s.employee_id] = (employeeHoursMap[s.employee_id] ?? 0) + shiftHours(s.start_time, s.end_time);
    }
    const hoursPerEmployee = employees.map(e => ({
        name: e.name.split(' ')[0],
        hours: Math.round((employeeHoursMap[e.id] ?? 0) * 10) / 10,
        max: e.weekly_hours_max,
        pct: Math.min(100, Math.round(((employeeHoursMap[e.id] ?? 0) / e.weekly_hours_max) * 100)),
    })).filter(e => e.hours > 0);
    const laborBudgetPerDay = laborCost ? Math.round(laborCost.labor_budget / 7) : 0;
    const laborVsTarget = (laborCost?.by_day ?? []).map(d => ({
        date: d.date.slice(5),
        cost: d.cost,
        budget: laborBudgetPerDay,
        pct: laborBudgetPerDay > 0 ? Math.round((d.cost / laborBudgetPerDay) * 100) : 0,
    }));
    const shiftCountByEmployee = employees.map(e => ({
        name: e.name.split(' ')[0],
        shifts: shifts.filter(s => s.employee_id === e.id).length,
    })).filter(e => e.shifts > 0);
    const alerts = [];
    for (const b of burnout) {
        const emp = employees.find(e => e.id === b.employee_id);
        if (!emp)
            continue;
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-foreground", children: "Dashboard" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Weekly overview and insights" })] }), _jsx("select", { className: NATIVE_SELECT_CLASS, value: selectedId ?? '', onChange: e => setSelectedId(Number(e.target.value)), children: schedules.map(s => (_jsxs("option", { value: s.id, children: ["Week of ", s.week_start, " (", s.status, ")"] }, s.id))) })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [isManager && (_jsx(KpiCard, { label: "Projected Labor Cost", value: laborCost ? `$${laborCost.projected_cost.toLocaleString()}` : '—', sub: laborCost ? `Budget $${laborCost.labor_budget.toLocaleString()}` : '', trend: overBudget ? 'down' : 'up', icon: _jsx(DollarIcon, {}) })), isManager && (_jsx(KpiCard, { label: "Budget Usage", value: laborCost ? `${budgetPct.toFixed(1)}%` : '—', sub: overBudget
                            ? `$${Math.abs(laborCost.variance).toFixed(0)} over budget`
                            : laborCost ? `$${Math.abs(laborCost.variance).toFixed(0)} under budget` : '', trend: budgetPct > 100 ? 'down' : budgetPct > 90 ? 'neutral' : 'up', icon: _jsx(ChartIcon, {}) })), _jsx(KpiCard, { label: "High Burnout Risk", value: highRisk.length.toString(), sub: highRisk.length > 0 ? highRisk.map(b => b.employee_name.split(' ')[0]).join(', ') : 'All clear', trend: highRisk.length > 0 ? 'down' : 'up', icon: _jsx(AlertIcon, {}) }), _jsx(KpiCard, { label: "Medium Risk", value: mediumRisk.length.toString(), sub: "employees need attention", trend: mediumRisk.length > 2 ? 'down' : 'neutral', icon: _jsx(UsersIcon, {}) }), isManager && estRevenue > 0 && (_jsx(KpiCard, { label: "Est. Revenue (Sales Goal)", value: `$${estRevenue.toLocaleString()}`, sub: "based on forecasts", trend: "neutral", icon: _jsx(TrendUpIcon, {}) })), isManager && estRevenue > 0 && (_jsx(KpiCard, { label: "Est. Expenses", value: `$${estExpenses.toLocaleString()}`, sub: `Labor $${estLaborCost.toFixed(0)} + overhead`, trend: "neutral", icon: _jsx(DollarIcon, {}) })), isManager && estRevenue > 0 && (_jsx(KpiCard, { label: "Est. Profit", value: estProfit > 0 ? `$${estProfit.toLocaleString()}` : `-$${Math.abs(estProfit).toLocaleString()}`, sub: "Revenue minus expenses", trend: estProfit > 0 ? 'up' : 'down', icon: _jsx(DollarIcon, {}) })), isManager && estRevenue > 0 && (_jsx(KpiCard, { label: "Labor % of Revenue", value: `${laborRevenuePct.toFixed(1)}%`, sub: laborRevenuePct > 35 ? 'Above 35% target' : 'Within target', trend: laborRevenuePct > 35 ? 'down' : 'up', icon: _jsx(ChartIcon, {}) })), isManager && (_jsx(KpiCard, { label: "High Turnover Risk", value: turnover.filter(t => t.risk_level === 'high').length.toString(), sub: turnover.filter(t => t.risk_level === 'high').length > 0 ? 'Needs attention' : 'Team stable', trend: turnover.filter(t => t.risk_level === 'high').length > 0 ? 'down' : 'up', icon: _jsx(UsersIcon, {}) }))] }), isManager && alerts.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(AlertIcon, {}), _jsx("h2", { className: "text-sm font-semibold text-foreground", children: "Alerts" }), _jsx(Badge, { variant: "danger", className: "text-xs", children: alerts.length })] }), _jsx("div", { className: "space-y-2 max-h-48 overflow-y-auto", children: alerts.map((a, i) => (_jsxs("div", { className: "flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20", children: [_jsx("span", { className: "mt-1 w-2 h-2 rounded-full flex-shrink-0", style: { backgroundColor: RISK_COLORS[a.level] } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-semibold text-foreground", children: a.type }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: a.message })] }), _jsx(Badge, { variant: riskVariant(a.level), className: "shrink-0 text-xs", children: a.level })] }, i))) })] })), isManager && (_jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [laborVsTarget.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: "Labor % vs Target" }), _jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: laborVsTarget, barSize: 18, barGap: 4, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f1f5f9" }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 11, fill: '#94a3b8' }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fontSize: 11, fill: '#94a3b8' }, tickFormatter: v => `$${v}`, axisLine: false, tickLine: false, width: 50 }), _jsx(Tooltip, { formatter: (v, name) => [`$${v.toFixed(2)}`, name === 'cost' ? 'Actual Cost' : 'Daily Budget'], contentStyle: { borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 } }), _jsx(Legend, { wrapperStyle: { fontSize: 11 } }), _jsx(Bar, { dataKey: "cost", name: "Actual Cost", fill: "#6366f1", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "budget", name: "Daily Budget", fill: "#e2e8f0", radius: [4, 4, 0, 0] })] }) })] })), hoursPerEmployee.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: "Hours per Employee" }), _jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: hoursPerEmployee, layout: "vertical", barSize: 14, children: [_jsx(XAxis, { type: "number", tick: { fontSize: 11, fill: '#94a3b8' }, axisLine: false, tickLine: false }), _jsx(YAxis, { dataKey: "name", type: "category", tick: { fontSize: 11, fill: '#64748b' }, axisLine: false, tickLine: false, width: 60 }), _jsx(Tooltip, { formatter: (v) => [`${v}h`, 'Hours'], contentStyle: { borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 } }), _jsx(Bar, { dataKey: "hours", radius: [0, 4, 4, 0], children: hoursPerEmployee.map((e, i) => (_jsx(Cell, { fill: e.pct >= 95 ? '#ef4444' : e.pct >= 80 ? '#f59e0b' : '#6366f1' }, i))) })] }) })] }))] })), isManager && employeeEfficiency.length > 0 && (_jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: "Employee Average Workload" }), _jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: employeeEfficiency, barSize: 22, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f1f5f9" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11, fill: '#94a3b8' }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fontSize: 11, fill: '#94a3b8' }, tickFormatter: v => `${v}h`, axisLine: false, tickLine: false, width: 40 }), _jsx(Tooltip, { formatter: (v) => [`${v}h`, 'Hours'], contentStyle: { borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 } }), _jsx(Bar, { dataKey: "avgWorkload", name: "Hours", fill: "#8b5cf6", radius: [6, 6, 0, 0] })] }) })] }), _jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-1", children: "Employee Efficiency" }), _jsx("p", { className: "text-xs text-muted-foreground mb-3", children: "Hours worked as % of weekly maximum" }), _jsx(ResponsiveContainer, { width: "100%", height: 185, children: _jsxs(BarChart, { data: employeeEfficiency, barSize: 22, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f1f5f9" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11, fill: '#94a3b8' }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fontSize: 11, fill: '#94a3b8' }, tickFormatter: v => `${v}%`, axisLine: false, tickLine: false, width: 40, domain: [0, 100] }), _jsx(Tooltip, { formatter: (v) => [`${v}%`, 'Utilization'], contentStyle: { borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 } }), _jsx(Bar, { dataKey: "efficiency", name: "Efficiency", radius: [6, 6, 0, 0], children: employeeEfficiency.map((e, i) => (_jsx(Cell, { fill: e.efficiency >= 95 ? '#ef4444' : e.efficiency >= 75 ? '#f59e0b' : '#10b981' }, i))) })] }) })] })] })), isManager && laborVsTarget.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: "Productivity Chart \u2013 Labor Cost Trend" }), _jsx(ResponsiveContainer, { width: "100%", height: 200, children: _jsxs(LineChart, { data: laborVsTarget, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f1f5f9" }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 11, fill: '#94a3b8' }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fontSize: 11, fill: '#94a3b8' }, tickFormatter: v => `$${v}`, axisLine: false, tickLine: false, width: 55 }), _jsx(Tooltip, { formatter: (v, name) => [`$${v.toFixed(2)}`, name === 'cost' ? 'Labor Cost' : 'Budget/Day'], contentStyle: { borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 } }), _jsx(Legend, { wrapperStyle: { fontSize: 11 } }), _jsx(Line, { type: "monotone", dataKey: "cost", name: "Labor Cost", stroke: "#6366f1", strokeWidth: 2, dot: { r: 3 } }), _jsx(Line, { type: "monotone", dataKey: "budget", name: "Budget/Day", stroke: "#94a3b8", strokeWidth: 2, strokeDasharray: "4 4", dot: false })] }) })] })), isManager && shiftCountByEmployee.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-1", children: "Shift Distribution Fairness" }), _jsx("p", { className: "text-xs text-muted-foreground mb-4", children: "Number of shifts assigned per employee this week" }), _jsx("div", { className: "space-y-2.5", children: shiftCountByEmployee.sort((a, b) => b.shifts - a.shifts).map((e, i) => {
                            const maxShifts = Math.max(...shiftCountByEmployee.map(x => x.shifts));
                            const pct = Math.round((e.shifts / maxShifts) * 100);
                            return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-xs text-foreground font-medium w-24 shrink-0 truncate", children: e.name }), _jsx("div", { className: "flex-1 bg-muted/50 rounded-full h-2.5 overflow-hidden", children: _jsx("div", { className: "h-2.5 rounded-full bg-primary transition-all", style: { width: `${pct}%` } }) }), _jsxs("span", { className: "text-xs font-semibold text-foreground w-14 text-right", children: [e.shifts, " shifts"] })] }, i));
                        }) })] })), isManager && (_jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [burnoutDistribution.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: "Labor Cost & Burnout Analytics" }), _jsxs("div", { className: "flex items-center gap-6", children: [_jsxs(PieChart, { width: 120, height: 120, children: [_jsx(Pie, { data: burnoutDistribution, dataKey: "value", cx: 55, cy: 55, outerRadius: 50, innerRadius: 28, children: burnoutDistribution.map((entry, i) => _jsx(Cell, { fill: entry.fill }, i)) }), _jsx(Tooltip, { formatter: (v, name) => [v, `${name} Risk`], contentStyle: { borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 } })] }), _jsxs("div", { className: "flex-1 space-y-2", children: [burnoutDistribution.map((d, i) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full", style: { backgroundColor: d.fill } }), _jsxs("span", { className: "text-xs text-foreground", children: [d.name, " Risk"] }), _jsx("span", { className: "text-xs font-bold text-foreground ml-auto", children: d.value })] }, i))), laborCost && (_jsxs("div", { className: "mt-3 pt-3 border-t border-border", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Total Labor Cost" }), _jsxs("p", { className: "text-sm font-bold text-foreground", children: ["$", laborCost.projected_cost.toFixed(0)] }), _jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: ["vs $", laborCost.labor_budget.toFixed(0), " budget"] })] }))] })] })] })), turnoverDistribution.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: "Turnover Risk" }), _jsxs("div", { className: "flex items-center gap-6", children: [_jsxs(PieChart, { width: 120, height: 120, children: [_jsx(Pie, { data: turnoverDistribution, dataKey: "value", cx: 55, cy: 55, outerRadius: 50, innerRadius: 28, children: turnoverDistribution.map((entry, i) => _jsx(Cell, { fill: entry.fill }, i)) }), _jsx(Tooltip, { formatter: (v, name) => [v, `${name} Risk`], contentStyle: { borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 } })] }), _jsxs("div", { className: "flex-1 space-y-2", children: [turnoverDistribution.map((d, i) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full", style: { backgroundColor: d.fill } }), _jsxs("span", { className: "text-xs text-foreground", children: [d.name, " Risk"] }), _jsx("span", { className: "text-xs font-bold text-foreground ml-auto", children: d.value })] }, i))), _jsxs("div", { className: "mt-3 pt-3 border-t border-border", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Employees at risk" }), _jsxs("p", { className: "text-sm font-bold text-foreground", children: [turnover.filter(t => t.risk_level !== 'low').length, " of ", turnover.length] })] })] })] })] }))] })), isManager && laborCost && laborCost.by_day.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: "Daily Labor Cost" }), _jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: laborCost.by_day, barSize: 28, children: [_jsx(XAxis, { dataKey: "date", tick: { fontSize: 11, fill: '#94a3b8' }, tickFormatter: d => d.slice(5), axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fontSize: 11, fill: '#94a3b8' }, tickFormatter: v => `$${v}`, axisLine: false, tickLine: false, width: 50 }), _jsx(Tooltip, { formatter: (v) => [`$${v.toFixed(2)}`, 'Cost'], labelFormatter: l => `Date: ${l}`, contentStyle: { borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 } }), _jsx(Bar, { dataKey: "cost", radius: [6, 6, 0, 0], children: laborCost.by_day.map((_, i) => _jsx(Cell, { fill: "#6366f1" }, i)) })] }) })] })), _jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [isManager && laborCost && laborCost.by_role.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: "Cost by Role" }), _jsx("div", { className: "space-y-3", children: laborCost.by_role.map(r => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-xs text-muted-foreground w-20 shrink-0", children: r.role }), _jsx("div", { className: "flex-1 bg-muted/50 rounded-full h-2 overflow-hidden", children: _jsx("div", { className: "h-2 bg-primary rounded-full transition-all", style: { width: `${Math.min(100, (r.cost / laborCost.projected_cost) * 100)}%` } }) }), _jsxs("span", { className: "text-xs font-semibold text-foreground w-14 text-right", children: ["$", r.cost.toFixed(0)] })] }, r.role))) })] })), _jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: "Burnout Risk Monitor" }), burnout.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground", children: [_jsxs("svg", { className: "w-8 h-8 text-emerald-400", fill: "none", stroke: "currentColor", strokeWidth: "1.5", viewBox: "0 0 24 24", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M8 12l2.5 2.5L16 9" })] }), _jsx("p", { className: "text-sm", children: "No burnout risks detected" })] })) : (_jsx("div", { className: "space-y-2 max-h-64 overflow-y-auto pr-1", children: burnout.map(b => (_jsxs("div", { className: "flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border", children: [_jsx("span", { className: "mt-1 w-2 h-2 rounded-full flex-shrink-0", style: { backgroundColor: RISK_COLORS[b.risk_level] } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-sm font-semibold text-foreground truncate", children: b.employee_name }), _jsxs("span", { className: "text-xs text-muted-foreground shrink-0", children: [b.weekly_hours, "h/wk"] })] }), b.factors.length > 0 && (_jsx("p", { className: "text-xs text-muted-foreground mt-0.5 truncate", children: b.factors.join(' · ') })), b.rest_days_recommended > 0 && (_jsxs("p", { className: "text-xs text-amber-600 mt-0.5", children: [b.rest_days_recommended, " rest day", b.rest_days_recommended > 1 ? 's' : '', " recommended"] }))] }), _jsx(Badge, { variant: riskVariant(b.risk_level), className: "shrink-0", children: b.risk_level })] }, b.employee_id))) }))] })] }), isManager && employees.length > 0 && selectedId && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-1", children: "Employee Overview" }), _jsx("p", { className: "text-xs text-muted-foreground mb-4", children: "Click an employee to view their stats, schedule, labor cost, burnout & turnover risk." }), _jsx("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-3", children: employees.map(emp => {
                            const hours = employeeHoursMap[emp.id] ?? 0;
                            const utilPct = Math.min(100, Math.round((hours / emp.weekly_hours_max) * 100));
                            const burnoutInfo = burnout.find(b => b.employee_id === emp.id);
                            const turnoverInfo = turnover.find(t => t.employee_id === emp.id);
                            const rankOf = rankRiskLevel;
                            const worstLevel = rankOf(burnoutInfo?.risk_level) >= rankOf(turnoverInfo?.risk_level)
                                ? burnoutInfo?.risk_level
                                : turnoverInfo?.risk_level;
                            return (_jsxs("button", { className: "text-left rounded-xl border border-border p-3 bg-background/40 hover:bg-muted/50 transition-colors cursor-pointer w-full", onClick: () => setSelectedEmployee(emp), children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground truncate", children: emp.name }), worstLevel && _jsx(Badge, { variant: riskVariant(worstLevel), className: "text-xs", children: worstLevel })] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [emp.role, " \u00B7 $", emp.hourly_rate, "/hr"] }), _jsxs("div", { className: "flex items-center justify-between text-xs mt-2", children: [_jsx("span", { className: "text-muted-foreground", children: "Hours" }), _jsxs("span", { className: "font-medium", children: [hours.toFixed(1), " / ", emp.weekly_hours_max, "h"] })] }), _jsx("div", { className: "h-1.5 rounded-full bg-muted mt-1 overflow-hidden", children: _jsx("div", { className: `h-full rounded-full ${utilPct >= 95 ? 'bg-red-500' : utilPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`, style: { width: `${utilPct}%` } }) }), burnoutInfo && (_jsxs("p", { className: "text-xs text-muted-foreground mt-1.5", children: ["Burnout: ", _jsx("span", { className: "font-semibold", style: { color: RISK_COLORS[burnoutInfo.risk_level] }, children: burnoutInfo.risk_level })] })), turnoverInfo && (_jsxs("p", { className: "text-xs text-muted-foreground", children: ["Turnover: ", _jsx("span", { className: "font-semibold", style: { color: RISK_COLORS[turnoverInfo.risk_level] }, children: turnoverInfo.risk_level })] }))] }, emp.id));
                        }) })] })), isManager && staffingSuggestions.length > 0 && (_jsxs(Card, { className: "p-5", children: [_jsx("div", { className: "flex items-center justify-between mb-4", children: _jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold text-foreground", children: "Demand-Based Staffing" }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: "Recommended staff count per day based on forecast revenue" })] }) }), _jsx("div", { className: "grid grid-cols-7 gap-2", children: staffingSuggestions.map(day => {
                            const totalStaff = day.staffing.reduce((sum, s) => sum + s.count, 0);
                            const roleGroups = {};
                            for (const s of day.staffing)
                                roleGroups[s.role] = (roleGroups[s.role] || 0) + s.count;
                            return (_jsxs("div", { className: "bg-muted/40 rounded-xl p-3 text-center border border-border", children: [_jsx("div", { className: "text-xs font-semibold text-muted-foreground", children: DAY_NAMES[day.day_of_week] }), _jsx("div", { className: "text-xs text-muted-foreground/70 mb-1", children: day.date.slice(5) }), _jsx("div", { className: "text-xl font-bold text-primary", children: totalStaff }), _jsx("div", { className: "text-xs text-muted-foreground", children: "staff" }), day.expected_revenue > 0 && (_jsxs("div", { className: "text-xs text-muted-foreground mt-1 font-medium", children: ["$", (day.expected_revenue / 1000).toFixed(1), "k"] })), _jsx("div", { className: "mt-2 space-y-0.5", children: Object.entries(roleGroups).map(([role, count]) => (_jsxs("div", { className: "text-[10px] text-muted-foreground", children: [count, " ", role] }, role))) })] }, day.date));
                        }) })] })), selectedEmployee && selectedId && (_jsx(EmployeeDetailModal, { employee: selectedEmployee, scheduleId: selectedId, onClose: () => setSelectedEmployee(null) }))] }));
}
