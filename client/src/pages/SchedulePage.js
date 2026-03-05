import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getSchedules, generateSchedule, getScheduleShifts, updateSchedule, deleteSchedule, getEmployees, createSwap, updateShift, getBurnoutRisks, getAvailability } from '../api';
import { useAuth } from '../AuthContext';
import { Button, Input, Card, Badge, NATIVE_SELECT_CLASS } from '../components/ui';
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHIFT_SLOTS = [
    { key: 'morning', label: 'Morning', min: 0, max: 12 * 60 },
    { key: 'mid', label: 'Mid', min: 12 * 60, max: 16 * 60 },
    { key: 'evening', label: 'Evening', min: 16 * 60, max: 20 * 60 },
    { key: 'close', label: 'Close', min: 20 * 60, max: 24 * 60 },
];
function toMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return (h * 60) + m;
}
function shiftSlot(startTime) {
    const mins = toMinutes(startTime);
    return SHIFT_SLOTS.find(slot => mins >= slot.min && mins < slot.max)?.key ?? 'close';
}
function shiftHours(start, end) {
    return (toMinutes(end) - toMinutes(start)) / 60;
}
function roleVariant(role) {
    const map = {
        Manager: 'manager',
        Server: 'server',
        Kitchen: 'kitchen',
        Bar: 'bar',
        Host: 'host',
    };
    return map[role] ?? 'default';
}
/** Role colour palette — left-bar accent + soft card background */
const ROLE_COLORS = {
    manager: { bg: '#f5f3ff', text: '#5b21b6', bar: '#7c3aed' },
    server: { bg: '#eff6ff', text: '#1d4ed8', bar: '#3b82f6' },
    kitchen: { bg: '#fff7ed', text: '#c2410c', bar: '#f97316' },
    bar: { bg: '#f0fdf4', text: '#15803d', bar: '#22c55e' },
    host: { bg: '#fdf2f8', text: '#9d174d', bar: '#ec4899' },
};
function shiftBlockStyle(role) {
    const c = ROLE_COLORS[role.toLowerCase()] ?? { bg: '#f8fafc', text: '#475569', bar: '#94a3b8' };
    return { backgroundColor: c.bg, color: c.text };
}
function shiftBarColor(role) {
    return (ROLE_COLORS[role.toLowerCase()] ?? { bar: '#94a3b8' }).bar;
}
export default function SchedulePage() {
    var _a;
    const { user } = useAuth();
    const isManager = user?.isManager ?? false;
    const [schedules, setSchedules] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return d.toISOString().split('T')[0];
    });
    const [budget, setBudget] = useState(5000);
    const [swapShift, setSwapShift] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [swapReason, setSwapReason] = useState('');
    const [swapTargetId, setSwapTargetId] = useState('');
    const [swapSubmitting, setSwapSubmitting] = useState(false);
    const [burnoutRisks, setBurnoutRisks] = useState([]);
    const [availabilityByEmployee, setAvailabilityByEmployee] = useState({});
    const [dropLoadingShiftId, setDropLoadingShiftId] = useState(null);
    const load = async () => {
        try {
            const s = await getSchedules();
            setSchedules(s);
            if (s.length > 0 && !selectedId)
                setSelectedId(s[0].id);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        getEmployees().then(async (data) => {
            setEmployees(data);
            const entries = await Promise.all(data.map(async (employee) => [employee.id, await getAvailability(employee.id).catch(() => [])]));
            setAvailabilityByEmployee(Object.fromEntries(entries));
        }).catch(err => console.error('Failed to load employees:', err));
    }, []);
    useEffect(() => {
        if (!selectedId)
            return;
        getScheduleShifts(selectedId).then(setShifts).catch(() => setShifts([]));
        getBurnoutRisks(selectedId).then(setBurnoutRisks).catch(() => setBurnoutRisks([]));
    }, [selectedId]);
    // Auto-refresh shifts when employee count changes (e.g. after add/delete)
    useEffect(() => {
        if (!selectedId || employees.length === 0)
            return;
        getScheduleShifts(selectedId).then(setShifts).catch(() => { });
    }, [employees.length, selectedId]);
    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const s = await generateSchedule(weekStart, budget);
            await load();
            setSelectedId(s.id);
        }
        catch (err) {
            alert('Error: ' + err.message);
        }
        finally {
            setGenerating(false);
        }
    };
    const handlePublish = async () => {
        if (!selectedId)
            return;
        const s = schedules.find(sc => sc.id === selectedId);
        if (!s)
            return;
        const newStatus = s.status === 'published' ? 'draft' : 'published';
        await updateSchedule(selectedId, { status: newStatus });
        await load();
    };
    const handleDeleteSchedule = async () => {
        if (!selectedId)
            return;
        const s = schedules.find(sc => sc.id === selectedId);
        if (!s)
            return;
        const confirmed = window.confirm(`Delete the schedule for the week of ${s.week_start}? This cannot be undone.`);
        if (!confirmed)
            return;
        setDeleting(true);
        try {
            await deleteSchedule(selectedId);
            const remaining = schedules.filter(sc => sc.id !== selectedId);
            setSchedules(remaining);
            setSelectedId(remaining.length > 0 ? remaining[0].id : null);
            setShifts([]);
        }
        catch (err) {
            alert('Error deleting schedule: ' + err.message);
        }
        finally {
            setDeleting(false);
        }
    };
    const handleOpenSwap = (shift) => {
        setSwapShift(shift);
        setSwapReason('');
        setSwapTargetId('');
    };
    const handleSubmitSwap = async () => {
        if (!swapShift || !user?.employeeId)
            return;
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
        }
        catch (err) {
            alert('Error: ' + err.message);
        }
        finally {
            setSwapSubmitting(false);
        }
    };
    const selectedSchedule = schedules.find(s => s.id === selectedId);
    const shiftsByDateAndSlot = {};
    const employeeHours = {};
    for (const shift of shifts) {
        shiftsByDateAndSlot[_a = shift.date] ?? (shiftsByDateAndSlot[_a] = { morning: [], mid: [], evening: [], close: [] });
        shiftsByDateAndSlot[shift.date][shiftSlot(shift.start_time)].push(shift);
        employeeHours[shift.employee_id] = (employeeHours[shift.employee_id] ?? 0) + shiftHours(shift.start_time, shift.end_time);
    }
    const burnoutByEmployee = Object.fromEntries(burnoutRisks.map(risk => [risk.employee_id, risk]));
    const hasAvailabilityWarning = (shift) => {
        const rules = availabilityByEmployee[shift.employee_id];
        if (!rules || rules.length === 0)
            return false;
        const day = new Date(shift.date).getDay();
        const shiftStart = toMinutes(shift.start_time);
        const shiftEnd = toMinutes(shift.end_time);
        return !rules.some(rule => {
            if (rule.day_of_week !== day)
                return false;
            const start = toMinutes(rule.start_time);
            const end = toMinutes(rule.end_time);
            return shiftStart >= start && shiftEnd <= end;
        });
    };
    const handleDropEmployee = async (targetShift, employeeId) => {
        if (!isManager || targetShift.employee_id === employeeId)
            return;
        setDropLoadingShiftId(targetShift.id);
        try {
            await updateShift(targetShift.id, { employee_id: employeeId });
            const refreshed = await getScheduleShifts(selectedId);
            setShifts(refreshed);
        }
        catch (err) {
            alert('Error: ' + err.message);
        }
        finally {
            setDropLoadingShiftId(null);
        }
    };
    const weekDates = selectedSchedule
        ? Array.from({ length: 7 }, (_, i) => {
            const d = new Date(selectedSchedule.week_start);
            d.setDate(d.getDate() + i);
            return d.toISOString().split('T')[0];
        })
        : [];
    if (loading) {
        return (_jsxs("div", { className: "flex items-center justify-center py-24 text-muted-foreground text-sm", children: [_jsxs("svg", { className: "w-4 h-4 animate-spin mr-2", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8v8z" })] }), "Loading schedule\u2026"] }));
    }
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-foreground", children: "Schedule Builder" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Generate, view, and publish weekly schedules" })] }), _jsxs("div", { className: "flex flex-wrap items-end gap-3 p-4 bg-white rounded-xl border border-border shadow-sm", children: [isManager && (_jsxs(_Fragment, { children: [_jsx(Input, { label: "Week Starting", type: "date", value: weekStart, onChange: e => setWeekStart(e.target.value) }), _jsx(Input, { label: "Labor Budget ($)", type: "number", className: "w-32", value: budget, onChange: e => setBudget(Number(e.target.value)), min: 1000, step: 500 }), _jsx(Button, { variant: "default", onClick: handleGenerate, disabled: generating, isLoading: generating, className: "self-end", children: "Auto-Generate Schedule" })] })), schedules.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "self-end space-y-1.5", children: [_jsx("label", { className: "block text-xs font-medium text-muted-foreground", children: "View Schedule" }), _jsx("select", { className: NATIVE_SELECT_CLASS, value: selectedId ?? '', onChange: e => setSelectedId(Number(e.target.value)), children: schedules.map(s => (_jsxs("option", { value: s.id, children: ["Week of ", s.week_start, " (", s.status, ")"] }, s.id))) })] }), isManager && selectedSchedule && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: selectedSchedule.status === 'published' ? 'outline' : 'default', onClick: handlePublish, className: "self-end", children: selectedSchedule.status === 'published' ? 'Unpublish' : 'Publish Schedule' }), _jsx(Button, { variant: "outline", onClick: handleDeleteSchedule, disabled: deleting, isLoading: deleting, className: "self-end text-red-600 border-red-200 hover:bg-red-50", children: "Delete Schedule" })] }))] }))] }), selectedSchedule && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: selectedSchedule.status === 'published' ? 'success' : 'secondary', children: selectedSchedule.status === 'published' ? 'Published' : 'Draft' }), _jsxs("span", { className: "text-sm text-muted-foreground", children: ["Week of ", selectedSchedule.week_start, " \u00B7 ", shifts.length, " shifts scheduled"] })] })), selectedSchedule && (_jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]", children: [_jsx("div", { className: "overflow-x-auto rounded-xl border border-border bg-white shadow-sm", children: _jsxs("div", { className: "grid grid-cols-[120px_repeat(7,minmax(140px,1fr))] min-w-[1120px]", children: [_jsx("div", { className: "border-b border-r border-border bg-muted/30 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Shift" }), weekDates.map((date, idx) => (_jsxs("div", { className: "border-b border-border border-r last:border-r-0 px-3 py-3 bg-muted/30 text-center", children: [_jsx("div", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: DAY_LABELS[idx] }), _jsx("div", { className: "text-sm font-bold text-foreground mt-0.5", children: date.slice(5) })] }, `hdr-${date}`))), SHIFT_SLOTS.map((slot, rowIdx) => (_jsxs("div", { className: "contents", children: [_jsx("div", { className: `border-r border-border px-3 py-3 text-sm font-semibold ${rowIdx < SHIFT_SLOTS.length - 1 ? 'border-b' : ''}`, children: slot.label }, `slot-${slot.key}`), weekDates.map((date, idx) => {
                                            const slotShifts = shiftsByDateAndSlot[date]?.[slot.key] ?? [];
                                            return (_jsx("div", { className: `border-r last:border-r-0 p-2 min-h-[140px] space-y-1.5 ${idx % 2 === 0 ? 'bg-white' : 'bg-background/60'} ${rowIdx < SHIFT_SLOTS.length - 1 ? 'border-b border-border' : ''}`, children: slotShifts.length === 0 ? (_jsx("p", { className: "text-xs text-muted-foreground/40 text-center mt-8 select-none", children: "Open" })) : (slotShifts.map(shift => {
                                                    const canRequestSwap = shift.status !== 'swapped' &&
                                                        (user?.isManager || shift.employee_id === user?.employeeId);
                                                    const warning = hasAvailabilityWarning(shift);
                                                    return (_jsx("div", { className: `rounded-lg text-xs overflow-hidden ${shift.status === 'swapped' ? 'opacity-40' : ''} ${dropLoadingShiftId === shift.id ? 'animate-pulse' : ''}`, style: shiftBlockStyle(shift.role), onDragOver: e => isManager && e.preventDefault(), onDrop: e => {
                                                            const employeeId = Number(e.dataTransfer.getData('text/plain'));
                                                            if (employeeId)
                                                                handleDropEmployee(shift, employeeId);
                                                        }, children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "w-[3px] shrink-0 rounded-l-lg", style: { backgroundColor: shiftBarColor(shift.role) } }), _jsxs("div", { className: "flex-1 px-2 py-1.5 min-w-0", children: [_jsx("div", { className: "font-semibold truncate text-[11px]", style: { textDecoration: shift.status === 'swapped' ? 'line-through' : undefined }, children: shift.employee_name }), _jsx(Badge, { variant: roleVariant(shift.role), className: "mt-0.5 text-[9px] px-1.5 py-0 h-4", children: shift.role }), _jsxs("div", { className: "opacity-60 mt-1 text-[10px] font-medium", children: [shift.start_time, "\u2013", shift.end_time] }), warning && _jsx("p", { className: "text-[10px] mt-1 text-amber-700 font-semibold", children: "Availability warning" }), canRequestSwap && (_jsx("button", { className: "mt-1 text-[10px] underline underline-offset-2 opacity-50 hover:opacity-100 transition-opacity", onClick: () => handleOpenSwap(shift), children: "Swap" }))] })] }) }, shift.id));
                                                })) }, `cell-${date}-${slot.key}`));
                                        })] }, `row-${slot.key}`)))] }) }), _jsxs(Card, { className: "p-4", children: [_jsx("h3", { className: "font-semibold text-foreground", children: "Employee list" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Drag employee cards onto a shift to reassign." }), _jsx("div", { className: "mt-3 space-y-2 max-h-[620px] overflow-y-auto pr-1", children: employees.map(employee => {
                                    const hours = employeeHours[employee.id] ?? 0;
                                    const utilization = Math.min(100, (hours / employee.weekly_hours_max) * 100);
                                    const burnout = burnoutByEmployee[employee.id];
                                    const availability = availabilityByEmployee[employee.id]?.length ?? 0;
                                    const isAtRisk = burnout?.risk_level === 'high' || utilization >= 95;
                                    return (_jsxs("div", { className: "rounded-lg border border-border p-3 bg-background/40", draggable: isManager, onDragStart: e => e.dataTransfer.setData('text/plain', String(employee.id)), children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-foreground truncate", children: employee.name }), _jsx(Badge, { variant: roleVariant(employee.role), children: employee.role })] }), _jsxs("div", { className: "flex items-center justify-between text-[11px] mt-2", children: [_jsx("span", { className: "text-muted-foreground", children: "Availability" }), _jsx("span", { className: availability > 0 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium', children: availability > 0 ? `${availability} rules` : 'No preferences' })] }), _jsxs("div", { className: "flex items-center justify-between text-[11px] mt-1", children: [_jsx("span", { className: "text-muted-foreground", children: "Hour tracking" }), _jsxs("span", { className: "font-medium", children: [hours.toFixed(1), " / ", employee.weekly_hours_max, "h"] })] }), _jsx("div", { className: "h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden", children: _jsx("div", { className: `h-full ${isAtRisk ? 'bg-rose-500' : 'bg-emerald-500'}`, style: { width: `${utilization}%` } }) }), isAtRisk && _jsx("p", { className: "mt-1.5 text-[10px] font-semibold text-rose-600", children: "Burnout alert" })] }, employee.id));
                                }) })] })] })), schedules.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center py-24 gap-3 text-center bg-white rounded-xl border border-border", children: [_jsx("div", { className: "w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground", children: _jsxs("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", strokeWidth: "1.5", viewBox: "0 0 24 24", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), _jsx("path", { d: "M16 2v4M8 2v4M3 10h18" })] }) }), _jsx("p", { className: "font-semibold text-foreground", children: "No schedules yet" }), _jsx("p", { className: "text-sm text-muted-foreground max-w-xs", children: isManager
                            ? 'Set a week start date and labor budget above, then click "Auto-Generate Schedule" to create your first optimized schedule.'
                            : 'No schedule has been published yet. Check back later.' })] })), swapShift && (_jsx("div", { className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4", onClick: e => e.target === e.currentTarget && setSwapShift(null), children: _jsxs(Card, { className: "w-full max-w-md shadow-2xl overflow-hidden p-0", children: [_jsxs("div", { className: "px-6 py-4 border-b border-border flex items-center justify-between", children: [_jsx("h2", { className: "text-base font-semibold text-foreground", children: "Request Shift Swap" }), _jsx("button", { onClick: () => setSwapShift(null), className: "w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: "2", viewBox: "0 0 24 24", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsx("div", { className: "px-6 pt-4", children: _jsxs("div", { className: "rounded-xl p-3 flex items-center gap-2.5", style: shiftBlockStyle(swapShift.role), children: [_jsx("div", { className: "w-1 self-stretch rounded-full shrink-0", style: { backgroundColor: shiftBarColor(swapShift.role) } }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold truncate", children: swapShift.employee_name }), _jsxs("p", { className: "text-xs opacity-70 mt-0.5", children: [swapShift.role, " \u00B7 ", swapShift.date, " \u00B7 ", swapShift.start_time, "\u2013", swapShift.end_time] })] })] }) }), _jsxs("div", { className: "px-6 py-4 space-y-4", children: [_jsx(Input, { label: "Reason (optional)", type: "text", placeholder: "e.g. Doctor appointment", value: swapReason, onChange: e => setSwapReason(e.target.value) }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-sm font-medium text-foreground", children: "Swap with (optional)" }), _jsxs("select", { className: `w-full ${NATIVE_SELECT_CLASS}`, value: swapTargetId, onChange: e => setSwapTargetId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 Any available employee \u2014" }), employees
                                                    .filter(e => e.id !== swapShift.employee_id && (e.role === swapShift.role || e.role === 'Manager'))
                                                    .map(e => (_jsxs("option", { value: e.id, children: [e.name, " (", e.role, ")"] }, e.id)))] })] })] }), _jsxs("div", { className: "px-6 pb-5 flex gap-2 border-t border-border pt-4", children: [_jsx(Button, { variant: "default", className: "flex-1", onClick: handleSubmitSwap, disabled: swapSubmitting, isLoading: swapSubmitting, children: "Submit Swap Request" }), _jsx(Button, { variant: "outline", onClick: () => setSwapShift(null), children: "Cancel" })] })] }) }))] }));
}
