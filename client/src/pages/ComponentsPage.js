import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Button, Card, Badge, Input, Modal } from '../components/ui';
/* ── Section wrappers ── */
function Section({ title, description, children }) {
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: title }), description && _jsx("p", { className: "text-xs text-muted-foreground/70 mt-0.5", children: description })] }), children] }));
}
function Sub({ title, children }) {
    return (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground/70", children: title }), children] }));
}
/* ── Inline icons ── */
function CalIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [_jsx("rect", { x: "2", y: "3", width: "12", height: "11", rx: "2" }), _jsx("path", { d: "M5 1v4M11 1v4M2 7h12" })] }));
}
function ClockIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [_jsx("circle", { cx: "8", cy: "8", r: "6" }), _jsx("path", { d: "M8 5v3l2 2" })] }));
}
function UserIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [_jsx("circle", { cx: "8", cy: "5", r: "3" }), _jsx("path", { d: "M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" })] }));
}
/* ── KPI card ── */
function KpiCard({ label, value, delta, deltaLabel }) {
    const isPositive = delta.startsWith('+');
    return (_jsxs(Card, { className: "p-5", children: [_jsx("p", { className: "text-xs text-muted-foreground uppercase tracking-wide", children: label }), _jsx("p", { className: "text-2xl font-bold text-foreground mt-1", children: value }), _jsxs("div", { className: "flex items-center gap-1 mt-1", children: [_jsx("span", { className: `text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`, children: delta }), _jsx("span", { className: "text-xs text-muted-foreground", children: deltaLabel })] })] }));
}
/* ── Shift block ── */
const ROLE_COLORS = {
    Manager: { bg: '#f5f3ff', text: '#5b21b6', bar: '#7c3aed' },
    Server: { bg: '#eff6ff', text: '#1d4ed8', bar: '#3b82f6' },
    Cook: { bg: '#fff7ed', text: '#c2410c', bar: '#f97316' },
    Cashier: { bg: '#f0fdf4', text: '#15803d', bar: '#22c55e' },
};
function ShiftBlock({ role, name, time, hours }) {
    const c = ROLE_COLORS[role] ?? { bg: '#f8fafc', text: '#475569', bar: '#94a3b8' };
    return (_jsx("div", { className: "rounded-lg overflow-hidden text-xs", style: { backgroundColor: c.bg, color: c.text }, children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "w-[3px] shrink-0 rounded-l-lg", style: { backgroundColor: c.bar } }), _jsxs("div", { className: "flex-1 px-3 py-2 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-semibold", children: name ?? role }), _jsx("div", { className: "opacity-60 mt-0.5", children: time })] }), _jsx("div", { className: "font-semibold", children: hours })] })] }) }));
}
const STATE_BADGES = [
    { variant: 'shift-scheduled', label: 'Scheduled' },
    { variant: 'shift-in-progress', label: 'In Progress' },
    { variant: 'shift-completed', label: 'Completed' },
    { variant: 'shift-cancelled', label: 'Cancelled' },
];
const STATE_SHIFTS = [
    { name: 'Sarah Johnson', time: '9:00 AM – 5:00 PM', state: 'Draft' },
    { name: 'Mike Chen', time: '10:00 AM – 6:00 PM', state: 'Published' },
    { name: 'Emma Davis', time: '8:00 AM – 4:00 PM', state: 'Confirmed' },
    { name: 'Alex Kim', time: '1:00 PM – 9:00 PM', state: 'Pending' },
];
const STATE_VARIANT = {
    Draft: 'default', Published: 'info', Confirmed: 'success', Pending: 'warning',
};
const EMPLOYEES = [
    { initials: 'SJ', name: 'Sarah Johnson', email: 'sarah@example.com', role: 'Manager', hours: 40, status: 'Active', risk: 'Low' },
    { initials: 'MC', name: 'Mike Chen', email: 'mike@example.com', role: 'Server', hours: 38, status: 'Active', risk: 'Moderate' },
    { initials: 'ED', name: 'Emma Davis', email: 'emma@example.com', role: 'Cook', hours: 45, status: 'Active', risk: 'High' },
];
const RISK_VARIANT = { Low: 'burnout-low', Moderate: 'burnout-moderate', High: 'burnout-high', Critical: 'burnout-critical' };
const ROLE_VARIANT = { Manager: 'manager', Server: 'server', Cook: 'kitchen' };
const AVATAR_BG = {
    Manager: 'bg-violet-100 text-violet-700',
    Server: 'bg-blue-100 text-blue-700',
    Cook: 'bg-orange-100 text-orange-700',
};
export default function ComponentsPage() {
    const [swapOpen, setSwapOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [nameVal, setNameVal] = useState('');
    const [passVal, setPassVal] = useState('');
    const [emailVal, setEmailVal] = useState('');
    const [roleVal, setRoleVal] = useState('');
    return (_jsxs("div", { className: "space-y-12 max-w-4xl", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-foreground", children: "UI Components" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "All components with variants, sizes, and states" })] }), _jsx(Section, { title: "Foundations \u2014 Colour Palette", children: _jsx(Card, { className: "p-5", children: _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [
                            { name: 'Primary', hex: '#6366f1', cls: 'bg-[#6366f1]' },
                            { name: 'Success', hex: '#10b981', cls: 'bg-emerald-500' },
                            { name: 'Warning', hex: '#f59e0b', cls: 'bg-amber-400' },
                            { name: 'Danger', hex: '#ef4444', cls: 'bg-red-500' },
                            { name: 'Background', hex: '#f8fafc', cls: 'bg-[#f8fafc] border' },
                            { name: 'Surface', hex: '#ffffff', cls: 'bg-white border' },
                            { name: 'Muted', hex: '#f1f5f9', cls: 'bg-[#f1f5f9] border' },
                            { name: 'Border', hex: '#e2e8f0', cls: 'bg-[#e2e8f0]' },
                        ].map(c => (_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: `w-8 h-8 rounded-lg shrink-0 ${c.cls}` }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-foreground", children: c.name }), _jsx("p", { className: "text-[10px] text-muted-foreground font-mono", children: c.hex })] })] }, c.name))) }) }) }), _jsx(Section, { title: "Buttons", children: _jsxs(Card, { className: "p-5 space-y-5", children: [_jsx(Sub, { title: "Variants", children: _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { variant: "default", children: "Primary" }), _jsx(Button, { variant: "secondary", children: "Secondary" }), _jsx(Button, { variant: "outline", children: "Outline" }), _jsx(Button, { variant: "ghost", children: "Ghost" }), _jsx(Button, { variant: "destructive", children: "Destructive" })] }) }), _jsx(Sub, { title: "Sizes", children: _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx(Button, { size: "sm", children: "Small" }), _jsx(Button, { size: "default", children: "Default" }), _jsx(Button, { size: "lg", children: "Large" })] }) }), _jsx(Sub, { title: "States", children: _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { children: "Normal" }), _jsx(Button, { disabled: true, children: "Disabled" }), _jsx(Button, { isLoading: true, children: "Loading" })] }) }), _jsx(Sub, { title: "With Icons", children: _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs(Button, { children: [_jsx(CalIcon, {}), "Schedule"] }), _jsxs(Button, { variant: "outline", children: [_jsx(ClockIcon, {}), "Time Off"] }), _jsxs(Button, { variant: "secondary", children: [_jsx(UserIcon, {}), "Profile"] })] }) })] }) }), _jsx(Section, { title: "Inputs", children: _jsx(Card, { className: "p-5", children: _jsxs("div", { className: "grid sm:grid-cols-2 gap-5", children: [_jsx(Input, { label: "Full name", placeholder: "e.g. Jane Smith", value: nameVal, onChange: e => setNameVal(e.target.value) }), _jsx(Input, { label: "Enter password", type: "password", placeholder: "Enter password", value: passVal, onChange: e => setPassVal(e.target.value) }), _jsx(Input, { label: "Email address", type: "email", placeholder: "email@example.com", value: emailVal, onChange: e => setEmailVal(e.target.value), error: "Please enter a valid email address" }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-sm font-medium text-foreground", children: "Choose a role" }), _jsxs("select", { className: "w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors", value: roleVal, onChange: e => setRoleVal(e.target.value), children: [_jsx("option", { value: "", children: "Choose a role" }), _jsx("option", { children: "Manager" }), _jsx("option", { children: "Server" }), _jsx("option", { children: "Cook" })] })] }), _jsx(Input, { label: "Disabled input", placeholder: "Disabled", disabled: true })] }) }) }), _jsx(Section, { title: "Badges", children: _jsxs(Card, { className: "p-5 space-y-5", children: [_jsx(Sub, { title: "Status", children: _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Badge, { variant: "info", children: "Info" }), _jsx(Badge, { variant: "success", children: "Success" }), _jsx(Badge, { variant: "warning", children: "Warning" }), _jsx(Badge, { variant: "danger", children: "Danger" })] }) }), _jsx(Sub, { title: "Roles", children: _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Badge, { variant: "manager", children: "Manager" }), _jsx(Badge, { variant: "server", children: "Server" }), _jsx(Badge, { variant: "kitchen", children: "Kitchen" }), _jsx(Badge, { variant: "bar", children: "Bar" }), _jsx(Badge, { variant: "host", children: "Host" })] }) }), _jsx(Sub, { title: "Burnout Risk", children: _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Badge, { variant: "burnout-low", children: "Low Risk" }), _jsx(Badge, { variant: "burnout-moderate", children: "Moderate Risk" }), _jsx(Badge, { variant: "burnout-high", children: "High Risk" }), _jsx(Badge, { variant: "burnout-critical", children: "Critical Risk" })] }) }), _jsx(Sub, { title: "Shift Status", children: _jsx("div", { className: "flex flex-wrap gap-2", children: STATE_BADGES.map(b => _jsx(Badge, { variant: b.variant, children: b.label }, b.variant)) }) })] }) }), _jsx(Section, { title: "KPI Cards", children: _jsxs("div", { className: "grid sm:grid-cols-3 gap-4", children: [_jsx(KpiCard, { label: "Total Employees", value: "247", delta: "+12.5%", deltaLabel: "vs last month" }), _jsx(KpiCard, { label: "Hours Scheduled", value: "1,842", delta: "+5.2%", deltaLabel: "vs last week" }), _jsx(KpiCard, { label: "Labor Cost", value: "$48.2K", delta: "+8.1%", deltaLabel: "vs last month" })] }) }), _jsx(Section, { title: "Calendar Shift Blocks", children: _jsx(Card, { className: "p-5", children: _jsxs("div", { className: "grid sm:grid-cols-2 gap-6", children: [_jsx(Sub, { title: "By Role", children: _jsxs("div", { className: "space-y-2", children: [_jsx(ShiftBlock, { role: "Manager", time: "8:00 AM \u2013 5:00 PM", hours: "9h" }), _jsx(ShiftBlock, { role: "Server", time: "11:00 AM \u2013 7:00 PM", hours: "8h" }), _jsx(ShiftBlock, { role: "Cook", time: "10:00 AM \u2013 6:00 PM", hours: "8h" }), _jsx(ShiftBlock, { role: "Cashier", time: "9:00 AM \u2013 5:00 PM", hours: "8h" })] }) }), _jsx(Sub, { title: "By State", children: _jsx("div", { className: "space-y-2", children: STATE_SHIFTS.map(s => (_jsxs("div", { className: "rounded-lg border border-border px-3 py-2.5 flex items-center justify-between text-xs bg-white", children: [_jsxs("div", { children: [_jsx("div", { className: "font-semibold text-foreground", children: s.name }), _jsx("div", { className: "text-muted-foreground mt-0.5", children: s.time })] }), _jsx(Badge, { variant: STATE_VARIANT[s.state], children: s.state })] }, s.name))) }) })] }) }) }), _jsx(Section, { title: "Tables", children: _jsx(Card, { className: "p-0 overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border bg-muted/40 text-left", children: [_jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Employee" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Role" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Hours/Week" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Status" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Burnout Risk" })] }) }), _jsx("tbody", { className: "divide-y divide-border", children: EMPLOYEES.map(emp => (_jsxs("tr", { className: "hover:bg-muted/20 transition-colors", children: [_jsx("td", { className: "px-5 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${AVATAR_BG[emp.role] ?? 'bg-muted'}`, children: emp.initials }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-foreground", children: emp.name }), _jsx("div", { className: "text-xs text-muted-foreground", children: emp.email })] })] }) }), _jsx("td", { className: "px-5 py-3", children: _jsx(Badge, { variant: ROLE_VARIANT[emp.role] ?? 'default', children: emp.role }) }), _jsx("td", { className: "px-5 py-3 text-foreground", children: emp.hours }), _jsx("td", { className: "px-5 py-3", children: _jsx(Badge, { variant: "success", children: emp.status }) }), _jsx("td", { className: "px-5 py-3", children: _jsx(Badge, { variant: RISK_VARIANT[emp.risk], children: emp.risk }) })] }, emp.name))) })] }) }) }), _jsx(Section, { title: "Modals", children: _jsx(Card, { className: "p-5", children: _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { variant: "outline", onClick: () => setSwapOpen(true), children: "Approve Swap Request" }), _jsx(Button, { variant: "default", onClick: () => setPublishOpen(true), children: "Publish Schedule" }), _jsx(Button, { variant: "destructive", onClick: () => setDeleteOpen(true), children: "Delete Shift" })] }) }) }), _jsx(Modal, { open: swapOpen, onClose: () => setSwapOpen(false), title: "Approve Swap Request", actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "destructive", size: "sm", onClick: () => setSwapOpen(false), children: "Deny" }), _jsx(Button, { variant: "default", size: "sm", onClick: () => setSwapOpen(false), children: "Approve" })] }), children: "Mike Chen wants to swap their Thursday shift with Sarah Johnson's Friday shift." }), _jsx(Modal, { open: publishOpen, onClose: () => setPublishOpen(false), title: "Publish Schedule", actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setPublishOpen(false), children: "Cancel" }), _jsx(Button, { variant: "default", size: "sm", onClick: () => setPublishOpen(false), children: "Publish" })] }), children: "Are you ready to publish the schedule for Week 12? This will notify all employees." }), _jsx(Modal, { open: deleteOpen, onClose: () => setDeleteOpen(false), title: "Delete Shift", actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setDeleteOpen(false), children: "Cancel" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => setDeleteOpen(false), children: "Delete" })] }), children: "Are you sure you want to delete this shift? This action cannot be undone." })] }));
}
