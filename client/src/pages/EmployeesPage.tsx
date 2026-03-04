import { useEffect, useState } from 'react';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, Employee } from '../api';
import { Button, Card, Badge, Input } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

const ROLES = ['Server', 'Kitchen', 'Bar', 'Host', 'Manager'];

function roleVariant(role: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    Manager: 'manager',
    Server: 'server',
    Kitchen: 'kitchen',
    Bar: 'bar',
    Host: 'host',
  };
  return map[role] ?? 'default';
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40 });

  const load = () => getEmployees().then(e => { setEmployees(e); setLoading(false); });

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateEmployee(editingId, form);
    } else {
      await createEmployee(form);
    }
    setShowForm(false);
    setEditingId(null);
    setForm({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40 });
    load();
  };

  const handleEdit = (emp: Employee) => {
    setForm({ name: emp.name, role: emp.role, hourly_rate: emp.hourly_rate, weekly_hours_max: emp.weekly_hours_max });
    setEditingId(emp.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this employee?')) return;
    await deleteEmployee(id);
    load();
  };

  if (loading) return <div className="flex justify-center py-20 text-neutral-500">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">Employees</h1>
        <Button
          variant="primary"
          size="sm"
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40 }); }}
        >
          + Add Employee
        </Button>
      </div>

      {showForm && (
        <Card>
          <h2 className="font-semibold mb-3">{editingId ? 'Edit Employee' : 'Add Employee'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Input
                required
                label="Name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Role</label>
              <select className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm mt-1" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Input
                label="Hourly Rate ($)"
                type="number"
                min={8}
                step={0.5}
                value={form.hourly_rate}
                onChange={e => setForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Input
                label="Max Weekly Hours"
                type="number"
                min={8}
                max={80}
                value={form.weekly_hours_max}
                onChange={e => setForm(f => ({ ...f, weekly_hours_max: Number(e.target.value) }))}
              />
            </div>
            <div className="col-span-2 md:col-span-4 flex gap-2 pt-1">
              <Button type="submit" variant="primary" size="sm">Save</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card noPadding>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b text-left">
              <th className="px-4 py-2 font-semibold text-neutral-600">Name</th>
              <th className="px-4 py-2 font-semibold text-neutral-600">Role</th>
              <th className="px-4 py-2 font-semibold text-neutral-600 text-right">Rate/hr</th>
              <th className="px-4 py-2 font-semibold text-neutral-600 text-right">Max Hours</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => (
              <tr key={emp.id} className={i % 2 === 0 ? '' : 'bg-neutral-50'}>
                <td className="px-4 py-2 font-medium">{emp.name}</td>
                <td className="px-4 py-2">
                  <Badge variant={roleVariant(emp.role)}>{emp.role}</Badge>
                </td>
                <td className="px-4 py-2 text-right">${emp.hourly_rate.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">{emp.weekly_hours_max}h</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(emp)} className="mr-1">Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(emp.id)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && (
          <p className="text-center py-8 text-neutral-400">No employees yet.</p>
        )}
      </Card>
    </div>
  );
}