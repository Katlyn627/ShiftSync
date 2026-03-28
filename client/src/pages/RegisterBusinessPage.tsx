import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { registerManager, type SiteType } from '../api';
import { Button, Input } from '../components/ui';

// ── Industry definitions ──────────────────────────────────────────────────
interface IndustryOption {
  value: SiteType;
  label: string;
  description: string;
  icon: string;
  defaultPositions: string[];
}

const INDUSTRIES: IndustryOption[] = [
  {
    value: 'restaurant',
    label: 'Restaurant / Food Service',
    description: 'Cafés, diners, fast-casual, fine dining',
    icon: '🍽️',
    defaultPositions: [
      'General Manager', 'Assistant Manager', 'Executive Chef', 'Sous Chef',
      'Line Cook', 'Prep Cook', 'Dishwasher', 'Server', 'Lead Server',
      'Bartender', 'Barback', 'Host', 'Busser',
    ],
  },
  {
    value: 'hotel',
    label: 'Hotel / Hospitality',
    description: 'Hotels, motels, resorts, bed & breakfasts',
    icon: '🏨',
    defaultPositions: [
      'General Manager', 'Front Desk Supervisor', 'Front Desk Agent', 'Night Auditor',
      'Concierge', 'Housekeeping Supervisor', 'Room Attendant', 'Laundry Attendant',
      'Maintenance Technician', 'Security Officer', 'Bellhop', 'Valet',
    ],
  },
  {
    value: 'retail',
    label: 'Retail',
    description: 'Clothing, grocery, hardware, specialty stores',
    icon: '🛒',
    defaultPositions: [
      'Store Manager', 'Assistant Manager', 'Shift Supervisor', 'Sales Associate',
      'Cashier', 'Stock Associate', 'Inventory Clerk', 'Loss Prevention Officer',
      'Visual Merchandiser', 'Customer Service Rep',
    ],
  },
  {
    value: 'healthcare',
    label: 'Healthcare',
    description: 'Clinics, medical offices, pharmacies, labs',
    icon: '🏥',
    defaultPositions: [
      'Medical Director', 'Physician', 'Registered Nurse', 'Licensed Practical Nurse',
      'Medical Assistant', 'Receptionist', 'Medical Records Clerk', 'Pharmacy Technician',
      'Lab Technician', 'Physical Therapist',
    ],
  },
  {
    value: 'fitness',
    label: 'Gym / Fitness',
    description: 'Gyms, yoga studios, sports facilities',
    icon: '💪',
    defaultPositions: [
      'Gym Manager', 'Personal Trainer', 'Group Fitness Instructor', 'Front Desk Associate',
      'Membership Advisor', 'Maintenance Technician', 'Childcare Attendant',
    ],
  },
  {
    value: 'salon_spa',
    label: 'Salon / Spa',
    description: 'Hair salons, nail salons, day spas, barbershops',
    icon: '💅',
    defaultPositions: [
      'Salon Manager', 'Hair Stylist', 'Colorist', 'Esthetician',
      'Nail Technician', 'Massage Therapist', 'Receptionist', 'Shampoo Assistant',
    ],
  },
  {
    value: 'warehouse',
    label: 'Warehouse / Logistics',
    description: 'Distribution centers, fulfillment, shipping',
    icon: '📦',
    defaultPositions: [
      'Warehouse Manager', 'Shift Supervisor', 'Warehouse Associate', 'Forklift Operator',
      'Picker', 'Packer', 'Receiving Clerk', 'Shipping Clerk', 'Quality Control Inspector',
    ],
  },
  {
    value: 'education',
    label: 'Education',
    description: 'Schools, tutoring centers, training facilities',
    icon: '🎓',
    defaultPositions: [
      'Principal', 'Assistant Principal', 'Teacher', 'Teaching Assistant',
      'Substitute Teacher', 'School Counselor', 'Administrative Assistant',
      'Custodian', 'Security Guard',
    ],
  },
  {
    value: 'childcare',
    label: 'Childcare',
    description: 'Daycare centers, preschools, after-school programs',
    icon: '👶',
    defaultPositions: [
      'Center Director', 'Lead Teacher', 'Assistant Teacher', 'Floater',
      'Administrative Coordinator', 'Cook', 'Bus Driver',
    ],
  },
  {
    value: 'security',
    label: 'Security Services',
    description: 'Security companies, guard services, facility security',
    icon: '🛡️',
    defaultPositions: [
      'Security Director', 'Site Supervisor', 'Security Officer', 'Patrol Officer',
      'Dispatcher', 'Access Control Officer', 'Mobile Patrol Officer',
    ],
  },
  {
    value: 'office',
    label: 'Office / Corporate',
    description: 'Administrative offices, co-working, corporate teams',
    icon: '🏢',
    defaultPositions: [
      'Office Manager', 'Administrative Assistant', 'Receptionist', 'HR Coordinator',
      'Accounting Clerk', 'IT Support Specialist', 'Data Entry Clerk', 'Executive Assistant',
    ],
  },
  {
    value: 'other',
    label: 'Other',
    description: "Something else — you'll define your own roles",
    icon: '✨',
    defaultPositions: ['Manager', 'Supervisor', 'Team Lead', 'Employee'],
  },
];

const ALL_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

type Step = 'business' | 'account' | 'positions' | 'confirm';

const STEPS: { id: Step; label: string }[] = [
  { id: 'business', label: 'Business Info' },
  { id: 'account', label: 'Your Account' },
  { id: 'positions', label: 'Positions' },
  { id: 'confirm', label: 'Confirm' },
];

export default function RegisterBusinessPage() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const [step, setStep] = useState<Step>('business');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1 — Business info
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [industry, setIndustry] = useState<SiteType | ''>('');

  // Step 2 — Manager account
  const [managerName, setManagerName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 3 — Positions
  const [positions, setPositions] = useState<string[]>([]);
  const [newPosition, setNewPosition] = useState('');

  const selectedIndustry = INDUSTRIES.find(i => i.value === industry);

  const stepIndex = STEPS.findIndex(s => s.id === step);

  // ── Navigation helpers ───────────────────────────────────────────────────
  const goToStep = (target: Step) => {
    setError('');
    setStep(target);
  };

  const handleBusinessNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !city.trim() || !state.trim() || !timezone || !industry) {
      return setError('Please fill in all fields and select an industry.');
    }
    if (selectedIndustry && positions.length === 0) {
      setPositions([...selectedIndustry.defaultPositions]);
    }
    goToStep('account');
  };

  const handleAccountNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerName.trim() || !username.trim() || !password || !confirmPassword) {
      return setError('Please fill in all fields.');
    }
    if (password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }
    goToStep('positions');
  };

  const handlePositionsNext = (e: React.FormEvent) => {
    e.preventDefault();
    goToStep('confirm');
  };

  const addPosition = () => {
    const trimmed = newPosition.trim();
    if (trimmed && !positions.includes(trimmed)) {
      setPositions([...positions, trimmed]);
    }
    setNewPosition('');
  };

  const removePosition = (pos: string) => {
    setPositions(positions.filter(p => p !== pos));
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await registerManager({
        businessName: businessName.trim(),
        city: city.trim(),
        state: state.trim(),
        timezone,
        industry,
        managerName: managerName.trim(),
        username: username.trim(),
        password,
        positions,
      });
      await loginWithToken(result.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px] space-y-6">

        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary shadow-lg shadow-primary/30 mb-1">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">ShiftSync</h1>
          <p className="text-sm text-muted-foreground">Set up your business in minutes</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 ${
                i < stepIndex
                  ? 'bg-primary text-white'
                  : i === stepIndex
                  ? 'bg-primary text-white ring-4 ring-primary/20'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === stepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${i < stepIndex ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-8 space-y-6">

          {/* ── Step 1: Business Info ── */}
          {step === 'business' && (
            <form onSubmit={handleBusinessNext} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Tell us about your business</h2>
                <p className="text-sm text-muted-foreground mt-0.5">We'll tailor ShiftSync to fit your industry.</p>
              </div>

              <Input
                label="Business Name"
                type="text"
                required
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Sunrise Café"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  type="text"
                  required
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Chicago"
                />
                <Input
                  label="State / Province"
                  type="text"
                  required
                  value={state}
                  onChange={e => setState(e.target.value)}
                  placeholder="e.g. IL"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Timezone</label>
                <select
                  required
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  {ALL_TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Industry / Business Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRIES.map(ind => (
                    <button
                      key={ind.value}
                      type="button"
                      onClick={() => setIndustry(ind.value)}
                      className={`text-left p-3 rounded-xl border transition-colors ${
                        industry === ind.value
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      <div className="text-xl mb-1">{ind.icon}</div>
                      <div className="text-xs font-semibold text-foreground leading-tight">{ind.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{ind.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" variant="default" size="default" className="w-full h-10 text-sm font-semibold">
                Continue →
              </Button>
            </form>
          )}

          {/* ── Step 2: Manager Account ── */}
          {step === 'account' && (
            <form onSubmit={handleAccountNext} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create your manager account</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  You'll use these credentials to sign in and manage <strong>{businessName}</strong>.
                </p>
              </div>

              <Input
                label="Your Full Name"
                type="text"
                required
                autoComplete="name"
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                placeholder="e.g. Alex Johnson"
              />
              <Input
                label="Username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                placeholder="e.g. alexj"
              />
              <Input
                label="Password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <Input
                label="Confirm Password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                error={error || undefined}
              />

              <div className="flex gap-3">
                <Button type="button" variant="outline" size="default" className="flex-1 h-10 text-sm" onClick={() => goToStep('business')}>
                  ← Back
                </Button>
                <Button type="submit" variant="default" size="default" className="flex-1 h-10 text-sm font-semibold">
                  Continue →
                </Button>
              </div>
            </form>
          )}

          {/* ── Step 3: Positions ── */}
          {step === 'positions' && (
            <form onSubmit={handlePositionsNext} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Define your positions</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  We've pre-populated roles common for <strong>{selectedIndustry?.label}</strong>. Add, remove, or keep as-is.
                </p>
              </div>

              {/* Current positions */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Active Positions</label>
                <div className="flex flex-wrap gap-2 min-h-[44px] p-3 rounded-xl border border-border bg-muted/20">
                  {positions.length === 0 && (
                    <span className="text-sm text-muted-foreground">No positions added yet.</span>
                  )}
                  {positions.map(pos => (
                    <span
                      key={pos}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                    >
                      {pos}
                      <button
                        type="button"
                        onClick={() => removePosition(pos)}
                        className="text-primary/60 hover:text-destructive transition-colors leading-none"
                        aria-label={`Remove ${pos}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Add custom position */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Add a Custom Position</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPosition}
                    onChange={e => setNewPosition(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPosition(); } }}
                    placeholder="e.g. Shift Lead"
                    className="flex-1 h-10 px-3 rounded-lg border border-input bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={addPosition}
                    className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                You can always add more positions later from the Employees page.
              </p>

              <div className="flex gap-3">
                <Button type="button" variant="outline" size="default" className="flex-1 h-10 text-sm" onClick={() => goToStep('account')}>
                  ← Back
                </Button>
                <Button type="submit" variant="default" size="default" className="flex-1 h-10 text-sm font-semibold">
                  Review →
                </Button>
              </div>
            </form>
          )}

          {/* ── Step 4: Confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Review & launch</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Everything look good? Hit Launch to create your account.</p>
              </div>

              <div className="rounded-xl border border-border divide-y divide-border text-sm">
                <div className="px-4 py-3 flex gap-3">
                  <span className="text-muted-foreground w-28 shrink-0">Business</span>
                  <span className="font-medium text-foreground">{businessName}</span>
                </div>
                <div className="px-4 py-3 flex gap-3">
                  <span className="text-muted-foreground w-28 shrink-0">Location</span>
                  <span className="font-medium text-foreground">{city}, {state}</span>
                </div>
                <div className="px-4 py-3 flex gap-3">
                  <span className="text-muted-foreground w-28 shrink-0">Industry</span>
                  <span className="font-medium text-foreground">{selectedIndustry?.icon} {selectedIndustry?.label}</span>
                </div>
                <div className="px-4 py-3 flex gap-3">
                  <span className="text-muted-foreground w-28 shrink-0">Timezone</span>
                  <span className="font-medium text-foreground">{ALL_TIMEZONES.find(t => t.value === timezone)?.label ?? timezone}</span>
                </div>
                <div className="px-4 py-3 flex gap-3">
                  <span className="text-muted-foreground w-28 shrink-0">Manager</span>
                  <span className="font-medium text-foreground">{managerName} <span className="text-muted-foreground font-normal">(@{username})</span></span>
                </div>
                <div className="px-4 py-3 flex gap-3">
                  <span className="text-muted-foreground w-28 shrink-0">Positions</span>
                  <span className="font-medium text-foreground">{positions.length > 0 ? `${positions.length} defined` : 'None (add later)'}</span>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-3">
                <Button type="button" variant="outline" size="default" className="flex-1 h-10 text-sm" onClick={() => goToStep('positions')}>
                  ← Back
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="default"
                  className="flex-1 h-10 text-sm font-semibold"
                  isLoading={loading}
                  onClick={handleSubmit}
                >
                  🚀 Launch ShiftSync
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
