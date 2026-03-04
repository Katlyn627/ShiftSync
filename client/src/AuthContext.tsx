import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AuthUser {
  userId: number;
  username: string;
  employeeId: number | null;
  isManager: boolean;
  employeeName: string | null;
  employeeRole: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('shiftsync_token');
    if (stored) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.user) {
            setToken(stored);
            setUser(data.user);
          } else {
            console.warn('Stored token invalid or expired, clearing session.');
            localStorage.removeItem('shiftsync_token');
          }
        })
        .catch(() => {
          console.warn('Failed to validate stored token, clearing session.');
          localStorage.removeItem('shiftsync_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('shiftsync_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('shiftsync_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
