import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Button, Input } from '../components/ui';
import { ShiftSyncLogo } from '../App';

/* ── Feature highlights shown on the hero panel ── */
const FEATURES = [
  { icon: '📅', label: 'Smart Scheduling', desc: 'AI-powered shift planning that adapts to your team' },
  { icon: '🔄', label: 'Shift Swaps', desc: 'Employees coordinate swaps — managers approve in one tap' },
  { icon: '🌡️', label: 'Burnout Detection', desc: 'Real-time wellbeing signals before problems escalate' },
  { icon: '⚖️', label: 'Fairness Engine', desc: 'Balanced hours distribution across your whole team' },
];

export default function LoginPage() {
  const { login, loginWithToken, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Handle token passed back from Google OAuth callback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('token');
    const oauthError = params.get('error');
    if (oauthToken) {
      window.history.replaceState({}, document.title, window.location.pathname);
      loginWithToken(oauthToken).catch(() => setError('Google sign-in failed.'));
    } else if (oauthError) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setError(decodeURIComponent(oauthError));
    }
  }, [loginWithToken]);

  const handleLogin = async (e: React.FormEvent) => {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(employeeName, regUsername, regPassword);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">

      {/* ── Left: Brand Hero Panel ── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[56%] flex-col justify-between p-10 xl:p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #3730A3 0%, #5046E4 40%, #7C3AED 75%, #0891B2 100%)' }}
      >
        {/* Subtle background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 w-64 h-64 rounded-full bg-violet-300/10 blur-3xl" />
        </div>

        {/* Brand mark */}
        <div className="relative flex items-center gap-3">
          <ShiftSyncLogo size={44} />
          <div>
            <span className="text-2xl font-extrabold text-white tracking-tight">ShiftSync</span>
            <p className="text-sm text-white/70 font-medium leading-tight">Smart scheduling for hospitality</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Scheduling that<br />
              <span className="text-cyan-300">works for everyone</span>
            </h1>
            <p className="text-lg text-white/75 max-w-md leading-relaxed">
              Built for restaurants, hotels, retail &amp; beyond — ShiftSync keeps your team happy, covered, and in sync.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 gap-3 max-w-md">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3.5">
                <span className="text-xl mt-0.5 shrink-0">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.label}</p>
                  <p className="text-xs text-white/65 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative text-xs text-white/40 font-medium">
          ShiftSync © 2025 · Trusted by hospitality teams
        </div>
      </div>

      {/* ── Right: Auth Form Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-10 lg:py-0">

        {/* Mobile brand header */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <ShiftSyncLogo size={36} />
          <span className="text-xl font-extrabold text-foreground tracking-tight">ShiftSync</span>
        </div>

        <div className="w-full max-w-[400px] space-y-5">

          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              {tab === 'login' ? 'Welcome back' : 'Join your team'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tab === 'login'
                ? 'Sign in to access your schedule and team tools'
                : 'Create your account to get started with ShiftSync'}
            </p>
          </div>

          {/* ── Tabs ── */}
          <div className="flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  tab === t
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'New Employee'}
              </button>
            ))}
          </div>

          {/* ── Form Card ── */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8 space-y-5">

            {/* Standalone error alert */}
            {error && (
              <div role="alert" aria-live="polite" className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {tab === 'login' ? (
              <>
                {/* Google Sign-In */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors text-sm font-medium text-foreground"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or sign in with username</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <Input
                    label="Username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. alice"
                  />
                  <Input
                    label="Password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <Button
                    type="submit"
                    variant="default"
                    size="default"
                    isLoading={loading}
                    className="w-full h-10 text-sm font-semibold"
                  >
                    Sign In
                  </Button>
                </form>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 text-sm text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> You must be added by your manager before creating an account.
                </div>
                <form onSubmit={handleRegister} className="space-y-4">
                  <Input
                    label="Your Full Name (as added by manager)"
                    type="text"
                    required
                    autoComplete="name"
                    value={employeeName}
                    onChange={e => setEmployeeName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                  />
                  <Input
                    label="Choose a Username"
                    type="text"
                    required
                    autoComplete="username"
                    value={regUsername}
                    onChange={e => setRegUsername(e.target.value)}
                    placeholder="e.g. janesmith"
                  />
                  <Input
                    label="Choose a Password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <Button
                    type="submit"
                    variant="default"
                    size="default"
                    isLoading={loading}
                    className="w-full h-10 text-sm font-semibold"
                  >
                    Create Account
                  </Button>
                </form>
              </>
            )}
          </div>

          {/* Register business link */}
          <p className="text-center text-sm text-muted-foreground">
            Manager setting up a new business?{' '}
            <button
              type="button"
              onClick={() => navigate('/register-business')}
              className="text-primary hover:underline font-semibold"
            >
              Register your business →
            </button>
          </p>

        </div>
      </div>
    </div>
  );
}
