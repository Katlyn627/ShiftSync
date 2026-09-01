import { useEffect, useMemo, useState } from 'react';
import {
  getEmployees,
  getSites,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getPositions,
  importEmployees,
  getEmployee,
  Employee,
  Site,
  Position,
  Availability,
  ShiftWithEmployee,
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Badge, Input, NATIVE_SELECT_CLASS, PageHeader, Modal, BusinessLogo, CertificationBadge } from '../components/ui';
import type { BadgeVariant } from '../components/ui';
import { AlertTriangle, Phone, Mail, Calendar, ShieldCheck, Clock, Eye, Sparkles } from 'lucide-react';

const FALLBACK_ROLES = ['Server', 'Kitchen', 'Bar', 'Bartender', 'Host', 'Manager', 'Front Desk', 'Housekeeping', 'F&B', 'Maintenance'];

function normalizeRoleLabel(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'bar') return 'Bartender';
  return role;
}

function roleVariant(role: string): BadgeVariant {
  const normalized = role.trim().toLowerCase();
  const map: Record<string, BadgeVariant> = {
    manager: 'manager', server: 'server', kitchen: 'kitchen', bar: 'bar', bartender: 'bar', host: 'host',
  };
  return map[normalized] ?? 'default';
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_BG: Record<string, string> = {
  Manager:     'bg-violet-100 text-violet-700',
  Server:      'bg-blue-100 text-blue-700',
  Kitchen:     'bg-orange-100 text-orange-700',
  Bar:         'bg-emerald-100 text-emerald-700',
  Bartender:   'bg-emerald-100 text-emerald-700',
  Host:        'bg-pink-100 text-pink-700',
  'Front Desk':'bg-sky-100 text-sky-700',
  Housekeeping:'bg-amber-100 text-amber-700',
  'F&B':       'bg-lime-100 text-lime-700',
  Maintenance: 'bg-gray-100 text-gray-700',
};

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites]         = useState<Site[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]           = useState<{
    name: string;
    role: string;
    hourly_rate: number;
    weekly_hours_max: number;
    email: string;
    phone: string;
    is_volunteer?: boolean | number;
    volunteer_max_hours?: number;
    emergency_contact?: string;
    certifications?: string;
    skills?: string;
    background_check_status?: string;
  }>({
    name: '',
    role: '',
    hourly_rate: 15,
    weekly_hours_max: 40,
    email: '',
    phone: '',
    is_volunteer: false,
    volunteer_max_hours: 16,
    emergency_contact: '',
    certifications: '',
    skills: '',
    background_check_status: 'cleared',
  });
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [inspectingEmpId, setInspectingEmpId] = useState<number | null>(null);
  const [employeeDetail, setEmployeeDetail] = useState<(Employee & { availability: Availability[]; shifts: ShiftWithEmployee[]; conflicts: Array<{ shift: any; reason: string }> }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleOpenDetail = async (empId: number) => {
    setInspectingEmpId(empId);
    setDetailLoading(true);
    try {
      const data = await getEmployee(empId);
      setEmployeeDetail(data);
    } catch (err) {
      console.error('Failed to load employee details', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setInspectingEmpId(null);
    setEmployeeDetail(null);
  };

  const roleOptions = positions.filter(p => p.is_active).map(p => p.name);
  const roles = useMemo(() => {
    const base = roleOptions.length > 0 ? roleOptions : FALLBACK_ROLES;
    const normalizedRoles = base.map((role) => normalizeRoleLabel(role));
    return Array.from(new Set(normalizedRoles));
  }, [roleOptions]);

  const load = () => Promise.all([
    getEmployees(),
    getSites(),
    getPositions().catch(() => [] as Position[]),
  ]).then(([emps, s, pos]) => {
    setEmployees(emps);
    setSites(s);
    setPositions(pos);
    // Set default role from fetched positions if form role is still empty
    const activeRoles = pos
      .filter((p: Position) => p.is_active)
      .map((p: Position) => normalizeRoleLabel(p.name));
    const defaultRole = (activeRoles.length > 0 ? activeRoles : FALLBACK_ROLES)[0] ?? '';
    setForm(f => f.role === '' ? { ...f, role: defaultRole } : f);
    setLoading(false);
  });
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const certList = typeof form.certifications === 'string'
        ? form.certifications.split(',').map(s => s.trim()).filter(Boolean)
        : form.certifications;
      const skillList = typeof form.skills === 'string'
        ? form.skills.split(',').map(s => s.trim()).filter(Boolean)
        : form.skills;

      const payload = {
        ...form,
        is_volunteer: form.is_volunteer ? 1 : 0,
        certifications: certList,
        skills: skillList,
      };

      if (editingId) { await updateEmployee(editingId, payload as any); }
      else           { await createEmployee(payload as any); }
    } catch (err: any) {
      setError(err.message || 'Failed to save employee. Please try again.');
      return;
    }
    setShowForm(false);
    setEditingId(null);
    setForm({
      name: '',
      role: roles[0] ?? '',
      hourly_rate: 15,
      weekly_hours_max: 40,
      email: '',
      phone: '',
      is_volunteer: false,
      volunteer_max_hours: 16,
      emergency_contact: '',
      certifications: '',
      skills: '',
      background_check_status: 'cleared',
    });
    load();
  };

  const handleEdit = (emp: Employee) => {
    const certs = typeof emp.certifications === 'string'
      ? (JSON.parse(emp.certifications || '[]') as string[])
      : (emp.certifications || []);
    const skills = typeof emp.skills === 'string'
      ? (JSON.parse(emp.skills || '[]') as string[])
      : (emp.skills || []);

    setForm({
      name: emp.name,
      role: emp.role,
      hourly_rate: emp.hourly_rate,
      weekly_hours_max: emp.weekly_hours_max,
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      is_volunteer: Boolean(emp.is_volunteer),
      volunteer_max_hours: emp.volunteer_max_hours || 16,
      emergency_contact: emp.emergency_contact ?? '',
      certifications: Array.isArray(certs) ? certs.join(', ') : '',
      skills: Array.isArray(skills) ? skills.join(', ') : '',
      background_check_status: emp.background_check_status || 'cleared',
    });
    setEditingId(emp.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this employee?')) return;
    await deleteEmployee(id);
    load();
  };

  const handleImport = async () => {
    setImportMessage(null);
    if (!importData.trim()) {
      setImportMessage('Paste employee data first.');
      return;
    }
    setImporting(true);
    try {
      const result = await importEmployees(importData, 'auto');
      setImportMessage(result.imported === 1 ? 'Imported 1 employee.' : `Imported ${result.imported} employees.`);
      setImportData('');
      await load();
    } catch (err: any) {
      setImportMessage(err.message || 'Failed to import employees.');
    } finally {
      setImporting(false);
    }
  };

  const siteMap = Object.fromEntries(sites.map(s => [s.id, s]));
  const currentSite = user?.siteId ? siteMap[user.siteId] : null;
  const visibleEmployees = employees;
  const importPanelId = 'employee-import-panel';
  const importPanelLabelId = 'employee-import-panel-label';

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
      <PageHeader
        title="Employees"
        subtitle={`${visibleEmployees.length} team member${visibleEmployees.length !== 1 ? 's' : ''}${currentSite ? ` · ${currentSite.name}` : ''}`}
        color="#7C3AED"
        icon="👥"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={showImportPanel}
              aria-controls={importPanelId}
              onClick={() => setShowImportPanel((v) => !v)}
            >
              Import Employees
            </Button>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setForm({ name: '', role: roles[0] ?? '', hourly_rate: 15, weekly_hours_max: 40, email: '', phone: '' });
              }}
            >
              + Add Employee
            </Button>
          </div>
        }
      />

      {/* ── Add / Edit Form ── */}
      {showForm && (
        <Card className="p-5 border-violet-200/70 shadow-[0_12px_28px_rgba(124,58,237,0.08)]">
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
                {roles.map(r => <option key={r}>{r}</option>)}
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
            <Input
              label="Emergency Contact"
              type="text"
              placeholder="e.g. (555) 999-1234 (Spouse)"
              value={form.emergency_contact}
              onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Background Check</label>
              <select
                className={`w-full ${NATIVE_SELECT_CLASS}`}
                value={form.background_check_status}
                onChange={e => setForm(f => ({ ...f, background_check_status: e.target.value }))}
              >
                <option value="cleared">Cleared</option>
                <option value="fbi_fingerprint_cleared">FBI Fingerprint Cleared</option>
                <option value="state_cori_cleared">State CORI Cleared</option>
                <option value="pending">Pending Review</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_volunteer)}
                  onChange={e => setForm(f => ({ ...f, is_volunteer: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 accent-emerald-600"
                />
                <span className="text-sm font-medium text-foreground">Humanitarian Volunteer</span>
              </label>
              {form.is_volunteer && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Weekly Cap:</span>
                  <input
                    type="number"
                    min={4}
                    max={40}
                    value={form.volunteer_max_hours || 16}
                    onChange={e => setForm(f => ({ ...f, volunteer_max_hours: Number(e.target.value) }))}
                    className="w-20 rounded border border-input px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">hrs</span>
                </div>
              )}
            </div>
            <div className="col-span-2 md:col-span-4">
              <Input
                label="Certifications (comma-separated)"
                type="text"
                placeholder="e.g. CPR_AED_Pediatric, Trauma_Informed_Care, FEMA_ICS_400"
                value={form.certifications}
                onChange={e => setForm(f => ({ ...f, certifications: e.target.value }))}
              />
            </div>
            <div className="col-span-2 md:col-span-4">
              <Input
                label="Skills / Specialties (comma-separated)"
                type="text"
                placeholder="e.g. Child Trauma Assessment, Rapid Relief Logistics, Spanish Fluency"
                value={form.skills}
                onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
              />
            </div>
            <div className="col-span-2 md:col-span-4 flex flex-col gap-2 pt-1 border-t border-border mt-1">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" variant="default" size="sm">
                  {editingId ? 'Save Changes' : 'Add Employee'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {showImportPanel && (
        <Card
          id={importPanelId}
          role="region"
          aria-labelledby={importPanelLabelId}
          className="p-5 space-y-3 border-violet-200/70"
        >
          <h2 id={importPanelLabelId} className="text-sm font-semibold text-foreground">Import from Spreadsheet Data</h2>
          <p className="text-xs text-muted-foreground">
            Paste spreadsheet rows with headers like <span className="font-medium">name, role, hourly_rate, weekly_hours_max, email, phone</span> or paste a JSON array.
          </p>
          <textarea
            className="w-full min-h-36 rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={'name,role,hourly_rate,weekly_hours_max,email,phone\nJane Smith,Server,18,35,jane@example.com,555-0101'}
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : 'Import Employees'}
            </Button>
            {importMessage && <span className="text-xs text-muted-foreground">{importMessage}</span>}
          </div>
        </Card>
      )}

      {/* ── Employees Table ── */}
      <Card className="overflow-hidden border-violet-200/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left bg-slate-50/90">
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role & Dept</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Credentials & Badges</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Site</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Rate / hr</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Max Hours</th>
              <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleEmployees.map(emp => {
              const site = emp.site_id ? siteMap[emp.site_id] : null;
              const certs = typeof emp.certifications === 'string'
                ? JSON.parse(emp.certifications || '[]')
                : (emp.certifications || []);
              const skills = typeof emp.skills === 'string'
                ? JSON.parse(emp.skills || '[]')
                : (emp.skills || []);

              return (
                <tr key={emp.id} className="transition-colors hover:bg-violet-50/50 cursor-pointer" onClick={(e) => {
                  // Don't open detail if user clicked on action buttons
                  if ((e.target as HTMLElement).closest('button, a, input')) return;
                  handleOpenDetail(emp.id);
                }}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                        {emp.photo_url ? (
                          <img src={emp.photo_url} alt={emp.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${AVATAR_BG[emp.role] ?? 'bg-muted text-muted-foreground'}`}>
                            {initials(emp.name)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground hover:text-violet-700">{emp.name}</span>
                          {emp.is_volunteer ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Volunteer ({emp.volunteer_max_hours || 16}h)
                            </span>
                          ) : null}
                        </div>
                        {emp.email && <div className="text-xs text-muted-foreground">{emp.email}</div>}
                        {emp.emergency_contact && (
                          <div className="text-[11px] text-amber-800 font-medium">📞 {emp.emergency_contact}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={roleVariant(emp.role)}>{normalizeRoleLabel(emp.role)}</Badge>
                    {emp.role_title && emp.role_title.trim().toLowerCase() !== emp.role.trim().toLowerCase() && (
                      <div className="text-xs text-muted-foreground mt-0.5">{emp.role_title}</div>
                    )}
                    {emp.department && (
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{emp.department}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                      {emp.background_check_status && emp.background_check_status !== 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                          <ShieldCheck className="w-3 h-3 text-blue-600" />
                          {emp.background_check_status.replace(/_/g, ' ')}
                        </span>
                      )}
                      {Array.isArray(certs) && certs.slice(0, 2).map((c: string, i: number) => (
                        <CertificationBadge key={i} cert={c} size="sm" />
                      ))}
                      {Array.isArray(certs) && certs.length > 2 && (
                        <span className="text-[11px] text-muted-foreground font-semibold self-center">+{certs.length - 2} more</span>
                      )}
                      {Array.isArray(skills) && skills.slice(0, 2).map((s: string, i: number) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    {site ? (
                      <span className="text-xs">
                        <span className="font-medium text-foreground">{site.name}</span>
                        <span className="text-muted-foreground ml-1">· {site.city}, {site.state}</span>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-foreground font-medium">
                    {emp.is_volunteer ? <span className="text-emerald-600 text-xs font-semibold">Volunteer</span> : `$${emp.hourly_rate.toFixed(2)}`}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{emp.weekly_hours_max}h</td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDetail(emp.id)} className="mr-1 shadow-xs">
                      <Eye className="w-3.5 h-3.5 mr-1 text-violet-600" />
                      View
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(emp)} className="mr-1">
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(emp.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleEmployees.length === 0 && (
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

      {/* ── Employee Quick-Lookup & Availability Detail Modal ── */}
      <Modal
        open={inspectingEmpId !== null}
        onClose={handleCloseDetail}
        title={employeeDetail ? `${employeeDetail.name} — Profile & Availability` : 'Employee Details'}
        className="max-w-2xl"
        actions={
          <div className="flex w-full items-center justify-between">
            {employeeDetail && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const emp = employees.find(e => e.id === employeeDetail.id);
                  if (emp) {
                    handleCloseDetail();
                    handleEdit(emp);
                  }
                }}
              >
                Edit Profile
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleCloseDetail}>
              Close
            </Button>
          </div>
        }
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <svg className="w-5 h-5 animate-spin mr-2 text-violet-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Loading profile, scheduling, and availability data…
          </div>
        ) : employeeDetail ? (
          <div className="space-y-4 py-1">
            {/* Header / Avatar & Role */}
            <div className="flex items-center gap-4 rounded-xl border border-violet-100 bg-violet-50/50 p-3.5">
              <div className="w-13 h-13 rounded-full overflow-hidden shrink-0 shadow-sm border border-violet-200">
                {employeeDetail.photo_url ? (
                  <img src={employeeDetail.photo_url} alt={employeeDetail.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-sm font-bold ${AVATAR_BG[employeeDetail.role] ?? 'bg-muted text-muted-foreground'}`}>
                    {initials(employeeDetail.name)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-foreground">{employeeDetail.name}</h3>
                  <Badge variant={roleVariant(employeeDetail.role)}>{normalizeRoleLabel(employeeDetail.role)}</Badge>
                  {employeeDetail.is_volunteer ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Volunteer ({employeeDetail.volunteer_max_hours || 16}h cap)
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-700">
                      ${employeeDetail.hourly_rate?.toFixed(2)}/hr · {employeeDetail.weekly_hours_max}h max/wk
                    </span>
                  )}
                </div>
                {employeeDetail.role_title && (
                  <div className="text-xs font-medium text-muted-foreground mt-0.5">{employeeDetail.role_title}</div>
                )}
                {employeeDetail.department && (
                  <div className="text-xs text-violet-700 font-semibold mt-0.5">{employeeDetail.department}</div>
                )}
              </div>
            </div>

            {/* Quick Contact & Emergency Call Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Direct Contacts</span>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    {employeeDetail.phone ? (
                      <a href={`tel:${employeeDetail.phone}`} className="font-semibold text-violet-700 hover:underline">
                        {employeeDetail.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No phone registered</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    {employeeDetail.email ? (
                      <a href={`mailto:${employeeDetail.email}`} className="font-semibold text-violet-700 hover:underline">
                        {employeeDetail.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No email registered</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 space-y-1.5">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1">
                  🚨 Emergency Contact (Direct Call)
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-950 truncate">
                    {employeeDetail.emergency_contact || 'None registered'}
                  </span>
                  {employeeDetail.emergency_contact && (
                    <a
                      href={`tel:${employeeDetail.emergency_contact.replace(/[^0-9+]/g, '')}`}
                      className="shrink-0 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs"
                    >
                      Call Now
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Clearance & Qualifications */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-2xs">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Clearance & Professional Credentials
              </span>
              <div className="flex flex-wrap gap-2 items-center">
                {employeeDetail.background_check_status && employeeDetail.background_check_status !== 'pending' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    {employeeDetail.background_check_status.replace(/_/g, ' ')}
                  </span>
                )}
                {(() => {
                  const certs = typeof employeeDetail.certifications === 'string'
                    ? JSON.parse(employeeDetail.certifications || '[]')
                    : (employeeDetail.certifications || []);
                  return Array.isArray(certs) && certs.map((c: string, idx: number) => (
                    <CertificationBadge key={idx} cert={c} size="md" showDetails={true} />
                  ));
                })()}
                {(() => {
                  const skills = typeof employeeDetail.skills === 'string'
                    ? JSON.parse(employeeDetail.skills || '[]')
                    : (employeeDetail.skills || []);
                  return Array.isArray(skills) && skills.map((s: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                      {s}
                    </span>
                  ));
                })()}
              </div>
            </div>

            {/* Live 7-Day Availability Grid */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-violet-600" />
                  Live Weekly Availability (Sunday – Saturday)
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">Auto-synced from employee profile</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, dayIdx) => {
                  const avail = employeeDetail.availability?.find(a => a.day_of_week === dayIdx);
                  const type = avail?.availability_type ?? 'specific';
                  const isUnavail = type === 'unavailable';
                  const isOpen = type === 'open';

                  return (
                    <div
                      key={dayIdx}
                      className={`rounded-md border p-2 text-center transition-all ${
                        isUnavail
                          ? 'border-rose-300 bg-rose-50/90 text-rose-900'
                          : isOpen
                          ? 'border-emerald-300 bg-emerald-50/80 text-emerald-900'
                          : 'border-blue-200 bg-blue-50/60 text-blue-900'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider">{dayName}</div>
                      <div className="mt-1 text-[10px] font-semibold">
                        {isUnavail ? (
                          <span className="text-rose-700">❌ Unavailable</span>
                        ) : isOpen ? (
                          <span className="text-emerald-700">✓ Open (All Day)</span>
                        ) : (
                          <span>{avail?.start_time || '08:00'} - {avail?.end_time || '23:59'}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Availability Conflicts Banner */}
            {employeeDetail.conflicts && employeeDetail.conflicts.length > 0 && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Availability Conflicts Detected ({employeeDetail.conflicts.length})</span>
                </div>
                <div className="space-y-1">
                  {employeeDetail.conflicts.map((c, i) => (
                    <div key={i} className="text-xs text-rose-800 bg-white/80 rounded px-2 py-1 border border-rose-200">
                      <span className="font-semibold">{c.shift?.date} ({c.shift?.start_time} - {c.shift?.end_time}):</span> {c.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Shift Assignments */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Active Shift Assignments (Next 7-14 Days)
              </span>
              {employeeDetail.shifts && employeeDetail.shifts.length > 0 ? (
                <div className="divide-y divide-border/60 max-h-36 overflow-y-auto">
                  {employeeDetail.shifts.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{s.date}</span>
                        <span className="text-muted-foreground ml-2">({s.start_time} - {s.end_time})</span>
                      </div>
                      <Badge variant={roleVariant(s.role)}>{s.role}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">No shifts scheduled for this employee.</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
