import { useState } from 'react';
import { Button, Card, Badge, Input, Modal } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

/* ── Section wrappers ── */
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}
function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground/70">{title}</p>
      {children}
    </div>
  );
}

/* ── Inline icons ── */
function CalIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="11" rx="2"/>
      <path d="M5 1v4M11 1v4M2 7h12"/>
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6"/>
      <path d="M8 5v3l2 2"/>
    </svg>
  );
}
function UserIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="3"/>
      <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
    </svg>
  );
}

/* ── KPI card ── */
function KpiCard({ label, value, delta, deltaLabel }: { label: string; value: string; delta: string; deltaLabel: string }) {
  const isPositive = delta.startsWith('+');
  return (
    <Card className="p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <div className="flex items-center gap-1 mt-1">
        <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>{delta}</span>
        <span className="text-xs text-muted-foreground">{deltaLabel}</span>
      </div>
    </Card>
  );
}

/* ── Shift block ── */
const ROLE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Manager: { bg: '#f5f3ff', text: '#5b21b6', bar: '#7c3aed' },
  Server:  { bg: '#eff6ff', text: '#1d4ed8', bar: '#3b82f6' },
  Cook:    { bg: '#fff7ed', text: '#c2410c', bar: '#f97316' },
  Cashier: { bg: '#f0fdf4', text: '#15803d', bar: '#22c55e' },
};
function ShiftBlock({ role, name, time, hours }: { role: string; name?: string; time: string; hours: string }) {
  const c = ROLE_COLORS[role] ?? { bg: '#f8fafc', text: '#475569', bar: '#94a3b8' };
  return (
    <div className="rounded-lg overflow-hidden text-xs" style={{ backgroundColor: c.bg, color: c.text }}>
      <div className="flex">
        <div className="w-[3px] shrink-0 rounded-l-lg" style={{ backgroundColor: c.bar }} />
        <div className="flex-1 px-3 py-2 flex items-center justify-between">
          <div>
            <div className="font-semibold">{name ?? role}</div>
            <div className="opacity-60 mt-0.5">{time}</div>
          </div>
          <div className="font-semibold">{hours}</div>
        </div>
      </div>
    </div>
  );
}

const STATE_BADGES: { variant: BadgeVariant; label: string }[] = [
  { variant: 'shift-scheduled',   label: 'Scheduled'   },
  { variant: 'shift-in-progress', label: 'In Progress' },
  { variant: 'shift-completed',   label: 'Completed'   },
  { variant: 'shift-cancelled',   label: 'Cancelled'   },
];

const STATE_SHIFTS = [
  { name: 'Sarah Johnson', time: '9:00 AM – 5:00 PM',  state: 'Draft'     as const },
  { name: 'Mike Chen',     time: '10:00 AM – 6:00 PM', state: 'Published' as const },
  { name: 'Emma Davis',    time: '8:00 AM – 4:00 PM',  state: 'Confirmed' as const },
  { name: 'Alex Kim',      time: '1:00 PM – 9:00 PM',  state: 'Pending'   as const },
];
const STATE_VARIANT: Record<string, BadgeVariant> = {
  Draft: 'default', Published: 'info', Confirmed: 'success', Pending: 'warning',
};

const EMPLOYEES = [
  { initials: 'SJ', name: 'Sarah Johnson', email: 'sarah@example.com', role: 'Manager', hours: 40, status: 'Active', risk: 'Low'      as const },
  { initials: 'MC', name: 'Mike Chen',     email: 'mike@example.com',  role: 'Server',  hours: 38, status: 'Active', risk: 'Moderate' as const },
  { initials: 'ED', name: 'Emma Davis',    email: 'emma@example.com',  role: 'Cook',    hours: 45, status: 'Active', risk: 'High'     as const },
];
const RISK_VARIANT: Record<string, BadgeVariant>  = { Low: 'burnout-low', Moderate: 'burnout-moderate', High: 'burnout-high', Critical: 'burnout-critical' };
const ROLE_VARIANT: Record<string, BadgeVariant>  = { Manager: 'manager', Server: 'server', Cook: 'kitchen' };
const AVATAR_BG:    Record<string, string>         = {
  Manager: 'bg-violet-100 text-violet-700',
  Server:  'bg-blue-100 text-blue-700',
  Cook:    'bg-orange-100 text-orange-700',
};

export default function ComponentsPage() {
  const [swapOpen,    setSwapOpen]    = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);

  const [nameVal,  setNameVal]  = useState('');
  const [passVal,  setPassVal]  = useState('');
  const [emailVal, setEmailVal] = useState('');
  const [roleVal,  setRoleVal]  = useState('');

  return (
    <div className="space-y-12 max-w-4xl">

      <div>
        <h1 className="text-xl font-bold text-foreground">UI Components</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All components with variants, sizes, and states</p>
      </div>

      {/* ════ FOUNDATIONS ════ */}
      <Section title="Foundations — Colour Palette">
        <Card className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'Primary',     hex: '#6366f1', cls: 'bg-[#6366f1]' },
              { name: 'Success',     hex: '#10b981', cls: 'bg-emerald-500' },
              { name: 'Warning',     hex: '#f59e0b', cls: 'bg-amber-400' },
              { name: 'Danger',      hex: '#ef4444', cls: 'bg-red-500' },
              { name: 'Background',  hex: '#f8fafc', cls: 'bg-[#f8fafc] border' },
              { name: 'Surface',     hex: '#ffffff', cls: 'bg-white border' },
              { name: 'Muted',       hex: '#f1f5f9', cls: 'bg-[#f1f5f9] border' },
              { name: 'Border',      hex: '#e2e8f0', cls: 'bg-[#e2e8f0]' },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg shrink-0 ${c.cls}`} />
                <div>
                  <p className="text-xs font-medium text-foreground">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ════ BUTTONS ════ */}
      <Section title="Buttons">
        <Card className="p-5 space-y-5">
          <Sub title="Variants">
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </Sub>
          <Sub title="Sizes">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </Sub>
          <Sub title="States">
            <div className="flex flex-wrap gap-3">
              <Button>Normal</Button>
              <Button disabled>Disabled</Button>
              <Button isLoading>Loading</Button>
            </div>
          </Sub>
          <Sub title="With Icons">
            <div className="flex flex-wrap gap-3">
              <Button><CalIcon />Schedule</Button>
              <Button variant="outline"><ClockIcon />Time Off</Button>
              <Button variant="secondary"><UserIcon />Profile</Button>
            </div>
          </Sub>
        </Card>
      </Section>

      {/* ════ INPUTS ════ */}
      <Section title="Inputs">
        <Card className="p-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <Input label="Full name" placeholder="e.g. Jane Smith" value={nameVal} onChange={e => setNameVal(e.target.value)} />
            <Input label="Enter password" type="password" placeholder="Enter password" value={passVal} onChange={e => setPassVal(e.target.value)} />
            <Input label="Email address" type="email" placeholder="email@example.com" value={emailVal} onChange={e => setEmailVal(e.target.value)} error="Please enter a valid email address" />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Choose a role</label>
              <select
                className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                value={roleVal}
                onChange={e => setRoleVal(e.target.value)}
              >
                <option value="">Choose a role</option>
                <option>Manager</option><option>Server</option><option>Cook</option>
              </select>
            </div>
            <Input label="Disabled input" placeholder="Disabled" disabled />
          </div>
        </Card>
      </Section>

      {/* ════ BADGES ════ */}
      <Section title="Badges">
        <Card className="p-5 space-y-5">
          <Sub title="Status">
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">Info</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
            </div>
          </Sub>
          <Sub title="Roles">
            <div className="flex flex-wrap gap-2">
              <Badge variant="manager">Manager</Badge>
              <Badge variant="server">Server</Badge>
              <Badge variant="kitchen">Kitchen</Badge>
              <Badge variant="bar">Bar</Badge>
              <Badge variant="host">Host</Badge>
            </div>
          </Sub>
          <Sub title="Burnout Risk">
            <div className="flex flex-wrap gap-2">
              <Badge variant="burnout-low">Low Risk</Badge>
              <Badge variant="burnout-moderate">Moderate Risk</Badge>
              <Badge variant="burnout-high">High Risk</Badge>
              <Badge variant="burnout-critical">Critical Risk</Badge>
            </div>
          </Sub>
          <Sub title="Shift Status">
            <div className="flex flex-wrap gap-2">
              {STATE_BADGES.map(b => <Badge key={b.variant} variant={b.variant}>{b.label}</Badge>)}
            </div>
          </Sub>
        </Card>
      </Section>

      {/* ════ KPI CARDS ════ */}
      <Section title="KPI Cards">
        <div className="grid sm:grid-cols-3 gap-4">
          <KpiCard label="Total Employees" value="247"    delta="+12.5%" deltaLabel="vs last month" />
          <KpiCard label="Hours Scheduled" value="1,842"  delta="+5.2%"  deltaLabel="vs last week"  />
          <KpiCard label="Labor Cost"      value="$48.2K" delta="+8.1%"  deltaLabel="vs last month" />
        </div>
      </Section>

      {/* ════ CALENDAR SHIFT BLOCKS ════ */}
      <Section title="Calendar Shift Blocks">
        <Card className="p-5">
          <div className="grid sm:grid-cols-2 gap-6">
            <Sub title="By Role">
              <div className="space-y-2">
                <ShiftBlock role="Manager" time="8:00 AM – 5:00 PM"   hours="9h" />
                <ShiftBlock role="Server"  time="11:00 AM – 7:00 PM"  hours="8h" />
                <ShiftBlock role="Cook"    time="10:00 AM – 6:00 PM"  hours="8h" />
                <ShiftBlock role="Cashier" time="9:00 AM – 5:00 PM"   hours="8h" />
              </div>
            </Sub>
            <Sub title="By State">
              <div className="space-y-2">
                {STATE_SHIFTS.map(s => (
                  <div key={s.name} className="rounded-lg border border-border px-3 py-2.5 flex items-center justify-between text-xs bg-white">
                    <div>
                      <div className="font-semibold text-foreground">{s.name}</div>
                      <div className="text-muted-foreground mt-0.5">{s.time}</div>
                    </div>
                    <Badge variant={STATE_VARIANT[s.state]}>{s.state}</Badge>
                  </div>
                ))}
              </div>
            </Sub>
          </div>
        </Card>
      </Section>

      {/* ════ TABLES ════ */}
      <Section title="Tables">
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hours/Week</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Burnout Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {EMPLOYEES.map(emp => (
                <tr key={emp.name} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${AVATAR_BG[emp.role] ?? 'bg-muted'}`}>
                        {emp.initials}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><Badge variant={ROLE_VARIANT[emp.role] ?? 'default'}>{emp.role}</Badge></td>
                  <td className="px-5 py-3 text-foreground">{emp.hours}</td>
                  <td className="px-5 py-3"><Badge variant="success">{emp.status}</Badge></td>
                  <td className="px-5 py-3"><Badge variant={RISK_VARIANT[emp.risk]}>{emp.risk}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      {/* ════ MODALS ════ */}
      <Section title="Modals">
        <Card className="p-5">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline"     onClick={() => setSwapOpen(true)}>Approve Swap Request</Button>
            <Button variant="default"     onClick={() => setPublishOpen(true)}>Publish Schedule</Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete Shift</Button>
          </div>
        </Card>
      </Section>

      <Modal open={swapOpen} onClose={() => setSwapOpen(false)} title="Approve Swap Request"
        actions={<>
          <Button variant="destructive" size="sm" onClick={() => setSwapOpen(false)}>Deny</Button>
          <Button variant="default"     size="sm" onClick={() => setSwapOpen(false)}>Approve</Button>
        </>}
      >
        Mike Chen wants to swap their Thursday shift with Sarah Johnson's Friday shift.
      </Modal>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publish Schedule"
        actions={<>
          <Button variant="outline"  size="sm" onClick={() => setPublishOpen(false)}>Cancel</Button>
          <Button variant="default"  size="sm" onClick={() => setPublishOpen(false)}>Publish</Button>
        </>}
      >
        Are you ready to publish the schedule for Week 12? This will notify all employees.
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Shift"
        actions={<>
          <Button variant="outline"     size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(false)}>Delete</Button>
        </>}
      >
        Are you sure you want to delete this shift? This action cannot be undone.
      </Modal>

    </div>
  );
}
