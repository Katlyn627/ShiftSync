import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import SchedulePage from './pages/SchedulePage';
import EmployeesPage from './pages/EmployeesPage';
import SwapsPage from './pages/SwapsPage';
import { Badge } from './components/ui';
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
/* ── Nav icon components ── */
function DashboardIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", viewBox: "0 0 20 20", fill: "currentColor", children: [_jsx("rect", { x: "2", y: "2", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "11", y: "2", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "2", y: "11", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "11", y: "11", width: "7", height: "7", rx: "1.5" })] }));
}
function ScheduleIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "4", width: "14", height: "13", rx: "2" }), _jsx("path", { d: "M7 2v4M13 2v4M3 9h14" })] }));
}
function EmployeesIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "8", cy: "6", r: "3" }), _jsx("path", { d: "M2 18c0-3.314 2.686-6 6-6s6 2.686 6 6" }), _jsx("path", { d: "M14 4c1.657 0 3 1.343 3 3s-1.343 3-3 3", strokeDasharray: "2 1" }), _jsx("path", { d: "M17 14c1.105 0.552 1.88 1.71 2 3" })] }));
}
function SwapIcon() {
    return (_jsxs("svg", { className: "w-4 h-4", viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M4 6h12M4 6l3-3M4 6l3 3" }), _jsx("path", { d: "M16 14H4M16 14l-3-3M16 14l-3 3" })] }));
}
export default function App() {
    const { user, logout, loading } = useAuth();
    if (loading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-2xl bg-primary flex items-center justify-center animate-pulse", children: _jsxs("svg", { className: "w-5 h-5 text-white", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 16 14" })] }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Loading ShiftSync\u2026" })] }) }));
    }
    if (!user)
        return _jsx(LoginPage, {});
    const NAV_ITEMS = [
        { to: '/', label: 'Dashboard', icon: _jsx(DashboardIcon, {}) },
        { to: '/schedule', label: 'Schedule', icon: _jsx(ScheduleIcon, {}) },
        ...(user.isManager ? [{ to: '/employees', label: 'Employees', icon: _jsx(EmployeesIcon, {}) }] : []),
        { to: '/swaps', label: 'Shift Swaps', icon: _jsx(SwapIcon, {}) },
    ];
    const initials = (user.employeeName || user.username)
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    return (_jsxs("div", { className: "min-h-screen flex flex-col bg-background", children: [_jsx("header", { className: "bg-white border-b border-border sticky top-0 z-40", children: _jsxs("div", { className: "max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between gap-6", children: [_jsxs("div", { className: "flex items-center gap-2.5 shrink-0", children: [_jsx("div", { className: "w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30", children: _jsxs("svg", { className: "w-4.5 h-4.5 text-white", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 16 14" })] }) }), _jsx("span", { className: "text-base font-bold text-foreground tracking-tight", children: "ShiftSync" })] }), _jsx("nav", { className: "flex items-center gap-1 overflow-x-auto", children: NAV_ITEMS.map(item => (_jsxs(NavLink, { to: item.to, end: item.to === '/', className: ({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`, children: [item.icon, item.label] }, item.to))) }), _jsxs("div", { className: "flex items-center gap-3 shrink-0", children: [_jsxs("div", { className: "hidden sm:flex items-center gap-2", children: [user.employeeRole && (_jsx(Badge, { variant: roleVariant(user.employeeRole), className: "text-xs", children: user.employeeRole })), _jsx("span", { className: "text-sm font-medium text-foreground", children: user.employeeName || user.username })] }), _jsx("div", { className: "w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center border border-primary/20", children: initials }), _jsx("button", { onClick: logout, className: "text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60", title: "Sign out", children: "Sign out" })] })] }) }), _jsx("main", { className: "flex-1 max-w-[1280px] mx-auto w-full px-6 py-6", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/schedule", element: _jsx(SchedulePage, {}) }), user.isManager && _jsx(Route, { path: "/employees", element: _jsx(EmployeesPage, {}) }), _jsx(Route, { path: "/swaps", element: _jsx(SwapsPage, {}) })] }) }), _jsx("footer", { className: "border-t border-border bg-white", children: _jsxs("div", { className: "max-w-[1280px] mx-auto px-6 h-10 flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: "ShiftSync \u00A9 2025" }), _jsx("span", { className: "text-xs text-muted-foreground", children: "Smart scheduling for hospitality" })] }) })] }));
}
