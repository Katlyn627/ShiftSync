import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button, Input, Badge } from '../components/ui';

const DEMO_ACCOUNTS = [
  { username: 'alice',  role: 'Manager', variant: 'manager' },
  { username: 'bob',    role: 'Server',  variant: 'server'  },
  { username: 'carol',  role: 'Server',  variant: 'server'  },
  { username: 'eve',    role: 'Kitchen', variant: 'kitchen' },
  { username: 'henry',  role: 'Bar',     variant: 'bar'     },
  { username: 'jack',   role: 'Host',    variant: 'host'    },
];

export default function LoginPage() {
  const { login, loginWithToken, register } = useAuth();
  const [tab, setTab] = useState('login');
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
      // Clear the token from the URL, then log in
      window.history.replaceState({}, document.title, window.location.pathname);
      loginWithToken(oauthToken).catch(() => setError('Google sign-in failed.'));
    } else if (oauthError) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setError(decodeURIComponent(oauthError));
    }
  }, [loginWithToken]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(employeeName, regUsername, regPassword);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u) => {
    setUsername(u);
    setPassword('password123');
    setError('');
    setTab('login');
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] space-y-6">

        {/* ── Brand ── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary shadow-lg shadow-primary/30 mb-1">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">ShiftSync</h1>
          <p className="text-sm text-muted-foreground">Smart scheduling &amp; burnout prevention for hospitality teams</p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex rounded-xl border border-border bg-muted/30 p-1 gap-1">
          {(['login', 'register']).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === t ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'login' ? 'Sign In' : 'New Employee'}
            </button>
          ))}
        </div>

        {/* ── Card ── */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-8 space-y-5">

          {tab === 'login' ? (
            <>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Sign in to your account</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Enter your credentials below</p>
              </div>

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-lg border border-border bg-white hover:bg-muted/40 transition-colors text-sm font-medium text-foreground"
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
                <span className="text-xs text-muted-foreground">or</span>
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
                  error={error || undefined}
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
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create your account</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  You must be added by a manager before registering.
                </p>
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
                  error={error || undefined}
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

        {/* ── Demo Credentials (only shown on login tab) ── */}
        {tab === 'login' && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Demo Accounts</p>
              <span className="text-xs text-muted-foreground">password: <code className="bg-muted px-1 py-0.5 rounded text-xs">password123</code></span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => fillDemo(acc.username)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0 uppercase group-hover:bg-primary/20 transition-colors">
                    {acc.username[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{acc.username}</div>
                    <Badge variant={acc.variant} className="text-[10px] px-1.5 py-0 mt-0.5">{acc.role}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
