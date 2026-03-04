import { useState } from 'react';
import { useAuth } from '../AuthContext';

const HERO_STATS = [
  { label: 'Open Shifts', value: '12' },
  { label: 'Coverage', value: '98%' },
  { label: 'Overtime Risk', value: 'Low' },
];

const FEATURE_STRIP = [
  { title: 'Smart Scheduling', description: 'Auto-generate optimized shifts.' },
  { title: 'Burnout Alerts', description: 'Identify clopen and overtime risks.' },
  { title: 'Shift Swapping', description: 'Easily manage swap requests.' },
];

const CORE_FEATURES = [
  { title: 'Schedule Builder', description: 'Intuitive drag-and-drop interface.' },
  { title: 'Burnout Risk Alerts', description: 'Clopen and overtime warnings.' },
  { title: 'Shift Swap Requests', description: 'Employee-driven swap approvals.' },
  { title: 'Labor Cost Tracking', description: 'Real-time labor analytics.' },
];

const STACK = ['React + Vite', 'Node.js + Express', 'PostgreSQL', 'Socket-powered realtime updates'];

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-bold tracking-tight">ShiftSync</p>
            <p className="text-blue-100 text-sm">Smart Scheduling + Burnout Prevention for Hospitality</p>
          </div>
          <nav className="hidden md:flex gap-6 text-blue-100 text-sm font-medium">
            <span>Home</span>
            <span>About</span>
            <span>Features</span>
            <span>Tech Stack</span>
          </nav>
          <button className="px-4 py-2 rounded-md bg-white/10 border border-white/30 text-sm font-semibold">Github Repo</button>
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-12 pt-6 grid lg:grid-cols-2 gap-8 items-start">
          <div>
            <h1 className="text-4xl font-bold leading-tight max-w-xl">Smart Scheduling & Burnout Prevention for Hospitality Teams.</h1>
            <p className="text-blue-100 text-lg mt-4 max-w-xl">Optimize schedules, reduce burnout, and control labor costs with one collaborative platform.</p>
            <div className="mt-7 grid sm:grid-cols-3 gap-3 max-w-xl">
              {HERO_STATS.map(stat => (
                <div key={stat.label} className="rounded-lg bg-white/10 border border-white/20 px-4 py-3">
                  <p className="text-xs text-blue-200 uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-5 shadow-2xl backdrop-blur-sm">
            <p className="text-sm text-blue-100 mb-3">Live Operations Snapshot</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-slate-800 p-3">
                <p className="text-xs text-slate-400">Team on Duty</p>
                <p className="text-2xl font-bold">27</p>
              </div>
              <div className="rounded-md bg-slate-800 p-3">
                <p className="text-xs text-slate-400">Labor Cost</p>
                <p className="text-2xl font-bold">$920</p>
              </div>
              <div className="rounded-md bg-slate-800 p-3">
                <p className="text-xs text-slate-400">Swap Requests</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
            <div className="mt-4 rounded-md bg-slate-800 h-32 flex items-end justify-around px-4 pb-4">
              {[50, 82, 60, 95, 72, 88].map((height, index) => (
                <div key={index} className="w-7 bg-gradient-to-t from-blue-500 to-cyan-300 rounded-t" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6 grid md:grid-cols-3 gap-5">
          {FEATURE_STRIP.map(feature => (
            <div key={feature.title} className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <h2 className="font-bold text-blue-900">{feature.title}</h2>
              <p className="text-sm text-slate-600 mt-1">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-2 gap-8 items-start">
        <div>
          <h2 className="text-3xl font-bold text-blue-900">Sign in to ShiftSync</h2>
          <p className="text-slate-600 mt-2">Use your account to manage schedules, track burnout indicators, and keep staffing balanced.</p>
          <ul className="mt-4 space-y-2 text-slate-700 text-sm list-disc list-inside">
            <li>Reduce overtime costs and labor inefficiencies.</li>
            <li>Improve team retention with better schedule fairness.</li>
            <li>Centralize shift swaps and approvals in one workflow.</li>
          </ul>

          <div className="mt-7 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80"
              alt="Hospitality manager reviewing scheduling workload"
              className="w-full h-64 object-cover"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                required
                autoComplete="username"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. alice"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-slate-50 rounded-lg text-xs text-slate-600">
            <p className="font-semibold text-slate-800 mb-2">Demo Accounts (password: password123)</p>
            <div className="grid grid-cols-2 gap-1">
              <div><strong>alice</strong> — Manager</div>
              <div><strong>bob</strong> — Server</div>
              <div><strong>carol</strong> — Server</div>
              <div><strong>eve</strong> — Kitchen</div>
              <div><strong>henry</strong> — Bar</div>
              <div><strong>jack</strong> — Host</div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <h2 className="text-3xl font-bold text-blue-900 text-center">Key Features</h2>
          <div className="mt-6 grid md:grid-cols-4 gap-4">
            {CORE_FEATURES.map(feature => (
              <div key={feature.title} className="rounded-xl border border-slate-200 p-5 bg-slate-50">
                <h3 className="font-bold text-blue-900">{feature.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-3xl font-bold text-blue-900">System Architecture</h2>
          <div className="mt-5 grid sm:grid-cols-3 gap-3 text-sm">
            <div className="border border-slate-200 bg-slate-50 rounded-lg p-3">
              <p className="font-semibold text-blue-900">Frontend</p>
              <p className="text-slate-600">React / Vite</p>
            </div>
            <div className="border border-slate-200 bg-slate-50 rounded-lg p-3">
              <p className="font-semibold text-blue-900">Backend</p>
              <p className="text-slate-600">Express API</p>
            </div>
            <div className="border border-slate-200 bg-slate-50 rounded-lg p-3">
              <p className="font-semibold text-blue-900">Data</p>
              <p className="text-slate-600">PostgreSQL</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-2xl font-bold text-blue-900">Tech Stack</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-700 list-disc list-inside">
            {STACK.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
