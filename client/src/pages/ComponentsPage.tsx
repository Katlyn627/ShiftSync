import { useState } from 'react';
import { Button, Card, Badge, Input, Modal } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

// ─── Section helper ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">{title}</h2>
      {children}
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-neutral-400">{title}</h3>
      {children}
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────────
function ScheduleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M5 1v4M11 1v4M2 7h12" />
    </svg>
  );
}

function TimeOffIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 2" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" />
    </svg>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, delta, deltaLabel }: { label: string; value: string; delta: string; deltaLabel: string }) {
  const isPositive = delta.startsWith('+');
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <div className="flex items-center gap-1">
        <span className={`text-xs font-medium ${isPositive ? 'text-success-dark' : 'text-danger-dark'}`}>{delta}</span>
        <span className="text-xs text-neutral-400">{deltaLabel}</span>
      </div>
    </Card>
  );
}

// ─── Shift Block ───────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Manager:  { bg: '#f3e8ff', text: '#6b21a8', bar: '#a855f7' },
  Server:   { bg: '#dbeafe', text: '#1e40af', bar: '#3b82f6' },
  Cook:     { bg: '#ffedd5', text: '#9a3412', bar: '#f97316' },
  Cashier:  { bg: '#dcfce7', text: '#166534', bar: '#22c55e' },
};

function ShiftBlock({ role, name, time, hours }: { role: string; name?: string; time: string; hours: string }) {
  const colors = ROLE_COLORS[role] ?? { bg: '#f1f5f9', text: '#334155', bar: '#94a3b8' };
  return (
    <div
      className="rounded-lg px-3 py-2 flex items-center justify-between text-xs"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <div className="flex items-center gap-2">
        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: colors.bar }} />
        <div>
          <div className="font-semibold">{name ?? role}</div>
          <div className="opacity-70">{time}</div>
        </div>
      </div>
      <div className="font-medium">{hours}</div>
    </div>
  );
}

const STATE_BADGES: { variant: BadgeVariant; label: string }[] = [
  { variant: 'shift-scheduled',   label: 'Scheduled' },
  { variant: 'shift-in-progress', label: 'In Progress' },
  { variant: 'shift-completed',   label: 'Completed' },
  { variant: 'shift-cancelled',   label: 'Cancelled' },
];

const STATE_SHIFTS = [
  { name: 'Sarah Johnson', time: '9:00 AM - 5:00 PM', state: 'Draft' as const },
  { name: 'Mike Chen',     time: '10:00 AM - 6:00 PM', state: 'Published' as const },
  { name: 'Emma Davis',    time: '8:00 AM - 4:00 PM',  state: 'Confirmed' as const },
  { name: 'Alex Kim',      time: '1:00 PM - 9:00 PM',  state: 'Pending' as const },
];

const STATE_VARIANT: Record<string, BadgeVariant> = {
  Draft:     'default',
  Published: 'info',
  Confirmed: 'success',
  Pending:   'warning',
};

// ─── Employee table rows ───────────────────────────────────────────────────────
const EMPLOYEES = [
  { initials: 'SJ', name: 'Sarah Johnson', email: 'sarah@example.com', role: 'Manager', hours: 40, status: 'Active', risk: 'Low' as const },
  { initials: 'MC', name: 'Mike Chen',     email: 'mike@example.com',  role: 'Server',  hours: 38, status: 'Active', risk: 'Moderate' as const },
  { initials: 'ED', name: 'Emma Davis',    email: 'emma@example.com',  role: 'Cook',    hours: 45, status: 'Active', risk: 'High' as const },
];

const RISK_VARIANT: Record<string, BadgeVariant> = {
  Low:      'burnout-low',
  Moderate: 'burnout-moderate',
  High:     'burnout-high',
  Critical: 'burnout-critical',
};

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  Manager: 'manager',
  Server:  'server',
  Cook:    'kitchen',
};

const AVATAR_COLORS = [
  'bg-brand-100 text-brand-700',
  'bg-success-light text-success-dark',
  'bg-warning-light text-warning-dark',
];

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ComponentsPage() {
  const [swapModalOpen,    setSwapModalOpen]    = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [deleteModalOpen,  setDeleteModalOpen]  = useState(false);

  const [nameValue,     setNameValue]     = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [emailValue,    setEmailValue]    = useState('');
  const [roleValue,     setRoleValue]     = useState('');
  const [emailError,    setEmailError]    = useState('Please enter a valid email address');

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Components</h1>
        <p className="text-neutral-500 mt-1">UI components with variants, sizes, and states</p>
      </div>

      {/* ── BUTTONS ──────────────────────────────────────────────────────────── */}
      <Section title="Buttons">
        <Card>
          <div className="space-y-6">
            {/* Variants */}
            <SubSection title="Variants">
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
              </div>
            </SubSection>

            {/* Sizes */}
            <SubSection title="Sizes">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Default</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
            </SubSection>

            {/* States */}
            <SubSection title="States">
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Normal</Button>
                <Button variant="primary" className="bg-brand-800">Hover</Button>
                <Button variant="primary" disabled>Disabled</Button>
              </div>
            </SubSection>

            {/* With Icons */}
            <SubSection title="With Icons">
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" size="md">
                  <span className="mr-2"><ScheduleIcon /></span>Schedule
                </Button>
                <Button variant="secondary" size="md">
                  <span className="mr-2"><TimeOffIcon /></span>Time Off
                </Button>
                <Button variant="outline" size="md">
                  <span className="mr-2"><ProfileIcon /></span>Profile
                </Button>
              </div>
            </SubSection>
          </div>
        </Card>
      </Section>

      {/* ── INPUTS ───────────────────────────────────────────────────────────── */}
      <Section title="Inputs">
        <Card>
          <div className="grid sm:grid-cols-2 gap-6">
            <Input
              label="Enter your name"
              placeholder="Enter your name"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <Input
                label="Full name"
                placeholder="e.g. Jane Smith"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
              />
              <p className="text-xs text-neutral-400">Helper text for additional context</p>
            </div>
            <Input
              label="Enter password"
              type="password"
              placeholder="Enter password"
              value={passwordValue}
              onChange={e => setPasswordValue(e.target.value)}
            />
            <Input
              label="email@example.com"
              type="email"
              placeholder="email@example.com"
              value={emailValue}
              onChange={e => setEmailValue(e.target.value)}
              error={emailError}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700">Choose a role</label>
              <select
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                value={roleValue}
                onChange={e => setRoleValue(e.target.value)}
              >
                <option value="">Choose a role</option>
                <option>Manager</option>
                <option>Server</option>
                <option>Cook</option>
              </select>
            </div>
            <Input
              label="Disabled"
              placeholder="Disabled input"
              disabled
            />
          </div>
        </Card>
      </Section>

      {/* ── BADGES ───────────────────────────────────────────────────────────── */}
      <Section title="Badges">
        <Card>
          <div className="space-y-5">
            <SubSection title="Status Badges">
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">Info</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
              </div>
            </SubSection>

            <SubSection title="Burnout Risk Levels">
              <div className="flex flex-wrap gap-2">
                <Badge variant="burnout-low">Low Risk</Badge>
                <Badge variant="burnout-moderate">Moderate Risk</Badge>
                <Badge variant="burnout-high">High Risk</Badge>
                <Badge variant="burnout-critical">Critical Risk</Badge>
              </div>
            </SubSection>

            <SubSection title="Shift Status">
              <div className="flex flex-wrap gap-2">
                {STATE_BADGES.map(b => (
                  <Badge key={b.variant} variant={b.variant}>{b.label}</Badge>
                ))}
              </div>
            </SubSection>
          </div>
        </Card>
      </Section>

      {/* ── CARDS ────────────────────────────────────────────────────────────── */}
      <Section title="Cards">
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="Total Employees" value="247" delta="+12.5%" deltaLabel="vs last month" />
            <KpiCard label="Hours Scheduled"  value="1,842" delta="+5.2%"  deltaLabel="vs last week" />
            <KpiCard label="Labor Cost"        value="$48.2K" delta="+8.1%"  deltaLabel="vs last month" />
          </div>

          {/* Calendar Shift Blocks */}
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Calendar Shift Blocks</p>
            <div className="grid sm:grid-cols-2 gap-6">
              {/* By Role */}
              <div className="space-y-2">
                <p className="text-xs text-neutral-400">By Role</p>
                <ShiftBlock role="Manager" time="8:00 AM - 5:00 PM" hours="9h" />
                <ShiftBlock role="Server"  time="11:00 AM - 7:00 PM" hours="8h" />
                <ShiftBlock role="Cook"    time="10:00 AM - 6:00 PM" hours="8h" />
                <ShiftBlock role="Cashier" time="9:00 AM - 5:00 PM"  hours="8h" />
              </div>

              {/* By State */}
              <div className="space-y-2">
                <p className="text-xs text-neutral-400">By State</p>
                {STATE_SHIFTS.map(s => (
                  <div
                    key={s.name}
                    className="rounded-lg border border-neutral-200 px-3 py-2 flex items-center justify-between text-xs bg-neutral-50"
                  >
                    <div>
                      <div className="font-semibold text-neutral-800">{s.name}</div>
                      <div className="text-neutral-500">{s.time}</div>
                    </div>
                    <Badge variant={STATE_VARIANT[s.state]}>{s.state}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </Section>

      {/* ── TABLES ───────────────────────────────────────────────────────────── */}
      <Section title="Tables">
        <Card noPadding>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th className="px-4 py-3 font-semibold text-neutral-600">Employee</th>
                <th className="px-4 py-3 font-semibold text-neutral-600">Role</th>
                <th className="px-4 py-3 font-semibold text-neutral-600">Hours/Week</th>
                <th className="px-4 py-3 font-semibold text-neutral-600">Status</th>
                <th className="px-4 py-3 font-semibold text-neutral-600">Burnout Risk</th>
              </tr>
            </thead>
            <tbody>
              {EMPLOYEES.map((emp, i) => (
                <tr key={emp.name} className={i % 2 === 1 ? 'bg-neutral-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${AVATAR_COLORS[i]}`}>
                        {emp.initials}
                      </div>
                      <div>
                        <div className="font-medium text-neutral-900">{emp.name}</div>
                        <div className="text-xs text-neutral-400">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_VARIANT[emp.role] ?? 'default'}>{emp.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{emp.hours}</td>
                  <td className="px-4 py-3">
                    <Badge variant="success">{emp.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={RISK_VARIANT[emp.risk]}>{emp.risk}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      <Section title="Modals">
        <Card>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setSwapModalOpen(true)}>Approve Swap Request</Button>
            <Button variant="primary"   onClick={() => setPublishModalOpen(true)}>Publish Schedule</Button>
            <Button variant="destructive" onClick={() => setDeleteModalOpen(true)}>Delete Shift</Button>
          </div>
        </Card>
      </Section>

      {/* ── Modal instances ──────────────────────────────────────────────────── */}
      <Modal
        open={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        title="Approve Swap Request"
        actions={
          <>
            <Button variant="destructive" size="sm" onClick={() => setSwapModalOpen(false)}>Deny</Button>
            <Button variant="primary"     size="sm" onClick={() => setSwapModalOpen(false)}>Approve</Button>
          </>
        }
      >
        Mike Chen wants to swap their Thursday shift with Sarah Johnson's Friday shift.
      </Modal>

      <Modal
        open={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publish Schedule"
        actions={
          <>
            <Button variant="outline"  size="sm" onClick={() => setPublishModalOpen(false)}>Cancel</Button>
            <Button variant="primary"  size="sm" onClick={() => setPublishModalOpen(false)}>Publish</Button>
          </>
        }
      >
        Are you ready to publish the schedule for Week 12? This will notify all employees.
      </Modal>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Shift"
        actions={
          <>
            <Button variant="outline"     size="sm" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteModalOpen(false)}>Delete</Button>
          </>
        }
      >
        Are you sure you want to delete this shift? This action cannot be undone.
      </Modal>
    </div>
  );
}
