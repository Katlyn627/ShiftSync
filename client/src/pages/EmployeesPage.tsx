import { useEffect, useState } from 'react';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, Employee } from '../api';

const ROLES = ['Server', 'Kitchen', 'Bar', 'Host', 'Manager'];

const ROLE_BADGE: Record<string, string> = {
  Manager: 'bg-purple-100 text-purple-700',
  Server: 'bg-blue-100 text-blue-700',
  Kitchen: 'bg-orange-100 text-orange-700',
  Bar: 'bg-green-100 text-green-700',
  Host: 'bg-pink-100 text-pink-700',
};

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

  if (loading) return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', role: 'Server', hourly_rate: 15, weekly_hours_max: 40 }); }}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Add Employee
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold mb-3">{editingId ? 'Edit Employee' : 'Add Employee'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500">Name</label>
              <input required className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Role</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Hourly Rate ($)</label>
              <input type="number" min={8} step={0.5} className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Max Weekly Hours</label>
              <input type="number" min={8} max={80} className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.weekly_hours_max} onChange={e => setForm(f => ({ ...f, weekly_hours_max: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2 md:col-span-4 flex gap-2 pt-1">
              <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-1.5 rounded text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left">
              <th className="px-4 py-2 font-semibold text-gray-600">Name</th>
              <th className="px-4 py-2 font-semibold text-gray-600">Role</th>
              <th className="px-4 py-2 font-semibold text-gray-600 text-right">Rate/hr</th>
              <th className="px-4 py-2 font-semibold text-gray-600 text-right">Max Hours</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => (
              <tr key={emp.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-medium">{emp.name}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[emp.role] || 'bg-gray-100 text-gray-700'}`}>
                    {emp.role}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">${emp.hourly_rate.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">{emp.weekly_hours_max}h</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleEdit(emp)} className="text-blue-600 hover:underline mr-3 text-xs">Edit</button>
                  <button onClick={() => handleDelete(emp.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && (
          <p className="text-center py-8 text-gray-400">No employees yet.</p>
        )}
      </div>
    </div>
  );
}