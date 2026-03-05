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
  Server:  'bg-blue-100 text-blue-700',
  Kitchen: 'bg-orange-100 text-orange-700',
  Bar:     'bg-emerald-100 text-emerald-700',
  Host:    'bg-pink-100 text-pink-700',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]           = useState({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40, email: '', phone: '' });

  const load = () => getEmployees().then(e => { setEmployees(e); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) { await updateEmployee(editingId, form); }
    else           { await createEmployee(form); }
    setShowForm(false);
    setEditingId(null);
    setForm({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40, email: '', phone: '' });
    load();
  };

  const handleEdit = (emp) => {
    setForm({ name: emp.name, role: emp.role, hourly_rate: emp.hourly_rate, weekly_hours_max: emp.weekly_hours_max, email: emp.email ?? '', phone: emp.phone ?? '' });
    setEditingId(emp.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee?')) return;
    await deleteEmployee(id);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading employees…
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{employees.length} team member{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40, email: '', phone: '' });
          }}
        >
          + Add Employee
        </Button>
      </div>

      {/* ── Add / Edit Form ── */}
      {showForm && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            {editingId ? 'Edit Employee' : 'Add New Employee'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <Input
                required
                label="Full Name"
                placeholder="e.g. Jane Smith"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role</label>
              <select
                className={`w-full ${NATIVE_SELECT_CLASS}`}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <Input
              label="Hourly Rate ($)"
              type="number"
              min={8}
              step={0.5}
              value={form.hourly_rate}
              onChange={e => setForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))}
            />
            <Input
              label="Max Weekly Hours"
              type="number"
              min={8}
              max={80}
              value={form.weekly_hours_max}
              onChange={e => setForm(f => ({ ...f, weekly_hours_max: Number(e.target.value) }))}
            />
            <Input
              label="Email (optional)"
              type="email"
              placeholder="employee@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Phone (optional)"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
            <div className="col-span-2 md:col-span-4 flex gap-2 pt-1 border-t border-border mt-1">
              <Button type="submit" variant="default" size="sm">
                {editingId ? 'Save Changes' : 'Add Employee'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Employees Table ── */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-left">
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Rate / hr</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Max Hours</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${AVATAR_BG[emp.role] ?? 'bg-muted text-muted-foreground'}`}>
                      {initials(emp.name)}
                    </div>
                    <span className="font-medium text-foreground">{emp.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={roleVariant(emp.role)}>{emp.role}</Badge>
                </td>
                <td className="px-5 py-3 text-right text-foreground font-medium">${(emp.hourly_rate ?? 0).toFixed(2)}</td>
                <td className="px-5 py-3 text-right text-muted-foreground">{(emp.weekly_hours_max ?? 0)}h</td>
                <td className="px-5 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(emp)} className="mr-1">
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(emp.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">No employees yet</p>
            <p className="text-xs text-muted-foreground">Click "+ Add Employee" to get started.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
