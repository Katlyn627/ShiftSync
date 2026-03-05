import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Button, Input, Badge } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

const DEMO_ACCOUNTS: { username: string; role: string; variant: BadgeVariant }[] = [
  { username: 'alice',  role: 'Manager', variant: 'manager' },
  { username: 'bob',    role: 'Server',  variant: 'server'  },
  { username: 'carol',  role: 'Server',  variant: 'server'  },
  { username: 'eve',    role: 'Kitchen', variant: 'kitchen' },
  { username: 'henry',  role: 'Bar',     variant: 'bar'     },
  { username: 'jack',   role: 'Host',    variant: 'host'    },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

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

  const fillDemo = (u: string) => {
    setUsername(u);
    setPassword('password123');
    setError('');
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

        {/* ── Login Card ── */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-8 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Enter your credentials below</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
        </div>

        {/* ── Demo Credentials ── */}
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

      </div>
    </div>
  );
}

