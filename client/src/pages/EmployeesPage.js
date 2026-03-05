import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../api';
import { Button, Card, Badge, Input, NATIVE_SELECT_CLASS } from '../components/ui';
const ROLES = ['Server', 'Kitchen', 'Bar', 'Host', 'Manager'];
function roleVariant(role) {
    const map = {
        Manager: 'manager', Server: 'server', Kitchen: 'kitchen', Bar: 'bar', Host: 'host',
    };
    return map[role] ?? 'default';
}
function initials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
const AVATAR_BG = {
    Manager: 'bg-violet-100 text-violet-700',
    Server: 'bg-blue-100 text-blue-700',
    Kitchen: 'bg-orange-100 text-orange-700',
    Bar: 'bg-emerald-100 text-emerald-700',
    Host: 'bg-pink-100 text-pink-700',
};
export default function EmployeesPage() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40 });
    const load = () => getEmployees().then(e => { setEmployees(e); setLoading(false); });
    useEffect(() => { load(); }, []);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editingId) {
            await updateEmployee(editingId, form);
        }
        else {
            await createEmployee(form);
        }
        setShowForm(false);
        setEditingId(null);
        setForm({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40 });
        load();
    };
    const handleEdit = (emp) => {
        setForm({ name: emp.name, role: emp.role, hourly_rate: emp.hourly_rate, weekly_hours_max: emp.weekly_hours_max });
        setEditingId(emp.id);
        setShowForm(true);
    };
    const handleDelete = async (id) => {
        if (!confirm('Delete this employee?'))
            return;
        await deleteEmployee(id);
        load();
    };
    if (loading) {
        return (_jsxs("div", { className: "flex items-center justify-center py-24 text-muted-foreground text-sm", children: [_jsxs("svg", { className: "w-4 h-4 animate-spin mr-2", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8v8z" })] }), "Loading employees\u2026"] }));
    }
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-foreground", children: "Employees" }), _jsxs("p", { className: "text-sm text-muted-foreground mt-0.5", children: [employees.length, " team member", employees.length !== 1 ? 's' : ''] })] }), _jsx(Button, { variant: "default", size: "sm", onClick: () => {
                            setShowForm(true);
                            setEditingId(null);
                            setForm({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40 });
                        }, children: "+ Add Employee" })] }), showForm && (_jsxs(Card, { className: "p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-foreground mb-4", children: editingId ? 'Edit Employee' : 'Add New Employee' }), _jsxs("form", { onSubmit: handleSubmit, className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsx("div", { className: "col-span-2", children: _jsx(Input, { required: true, label: "Full Name", placeholder: "e.g. Jane Smith", value: form.name, onChange: e => setForm(f => ({ ...f, name: e.target.value })) }) }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-sm font-medium text-foreground", children: "Role" }), _jsx("select", { className: `w-full ${NATIVE_SELECT_CLASS}`, value: form.role, onChange: e => setForm(f => ({ ...f, role: e.target.value })), children: ROLES.map(r => _jsx("option", { children: r }, r)) })] }), _jsx(Input, { label: "Hourly Rate ($)", type: "number", min: 8, step: 0.5, value: form.hourly_rate, onChange: e => setForm(f => ({ ...f, hourly_rate: Number(e.target.value) })) }), _jsx(Input, { label: "Max Weekly Hours", type: "number", min: 8, max: 80, value: form.weekly_hours_max, onChange: e => setForm(f => ({ ...f, weekly_hours_max: Number(e.target.value) })) }), _jsxs("div", { className: "col-span-2 md:col-span-4 flex gap-2 pt-1 border-t border-border mt-1", children: [_jsx(Button, { type: "submit", variant: "default", size: "sm", children: editingId ? 'Save Changes' : 'Add Employee' }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setShowForm(false), children: "Cancel" })] })] })] })), _jsxs(Card, { className: "p-0 overflow-hidden", children: [_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-muted/40 border-b border-border text-left", children: [_jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Employee" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Role" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right", children: "Rate / hr" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right", children: "Max Hours" }), _jsx("th", { className: "px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y divide-border", children: employees.map(emp => (_jsxs("tr", { className: "hover:bg-muted/20 transition-colors", children: [_jsx("td", { className: "px-5 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${AVATAR_BG[emp.role] ?? 'bg-muted text-muted-foreground'}`, children: initials(emp.name) }), _jsx("span", { className: "font-medium text-foreground", children: emp.name })] }) }), _jsx("td", { className: "px-5 py-3", children: _jsx(Badge, { variant: roleVariant(emp.role), children: emp.role }) }), _jsxs("td", { className: "px-5 py-3 text-right text-foreground font-medium", children: ["$", emp.hourly_rate.toFixed(2)] }), _jsxs("td", { className: "px-5 py-3 text-right text-muted-foreground", children: [emp.weekly_hours_max, "h"] }), _jsxs("td", { className: "px-5 py-3 text-right", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleEdit(emp), className: "mr-1", children: "Edit" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => handleDelete(emp.id), children: "Delete" })] })] }, emp.id))) })] }), employees.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 gap-2 text-center", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground", children: _jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", viewBox: "0 0 24 24", children: [_jsx("path", { d: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" }), _jsx("circle", { cx: "9", cy: "7", r: "4" })] }) }), _jsx("p", { className: "text-sm font-medium text-foreground", children: "No employees yet" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Click \"+ Add Employee\" to get started." })] }))] })] }));
}
