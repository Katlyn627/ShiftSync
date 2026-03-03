import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoLogin } from '../api';
import { useAuth } from '../AuthContext';

const SERVER_BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  // Handle token in URL after OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const err = params.get('error');
    if (token) {
      // Decode user info from JWT payload (no verification needed on client)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        login(token, {
          userId: payload.userId,
          role: payload.role,
          employeeId: payload.employeeId,
          displayName: payload.displayName,
        });
        navigate('/', { replace: true });
      } catch (err) {
        console.error('[auth] Failed to parse OAuth token:', err);
        setError('Failed to process login token.');
      }
    }
    if (err) {
      const messages: Record<string, string> = {
        google_not_configured: 'Google OAuth is not configured on this server.',
        google_auth_failed: 'Google sign-in failed. Please try again.',
        microsoft_not_configured: 'Microsoft OAuth is not configured on this server.',
        microsoft_auth_failed: 'Microsoft sign-in failed. Please try again.',
      };
      setError(messages[err] || 'Sign-in failed. Please try again.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDemoLogin = async (type: 'manager' | 'employee') => {
    setLoading(type);
    setError(null);
    try {
      const { token, user: u } = await demoLogin(type);
      login(token, u);
      navigate('/', { replace: true });
    } catch (e: any) {
      setError(e.message || 'Demo login failed.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
        {/* Logo + Title */}
        <div className="text-center space-y-2">
          <div className="text-5xl">⏰</div>
          <h1 className="text-3xl font-bold text-gray-800">ShiftSync</h1>
          <p className="text-gray-500 text-sm">Smart Scheduling + Burnout Prevention</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* OAuth buttons */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Sign in with</p>
          <a
            href={`${SERVER_BASE}/api/auth/google`}
            className="flex items-center justify-center gap-3 w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>
          <a
            href={`${SERVER_BASE}/api/auth/microsoft`}
            className="flex items-center justify-center gap-3 w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 23 23">
              <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
            Continue with Microsoft
          </a>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-gray-400">or try demo mode</span>
          </div>
        </div>

        {/* Demo login buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleDemoLogin('manager')}
            disabled={loading !== null}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading === 'manager' ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>👔</span>
            )}
            Login as Manager (Demo)
          </button>
          <button
            onClick={() => handleDemoLogin('employee')}
            disabled={loading !== null}
            className="w-full bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading === 'employee' ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>👤</span>
            )}
            Login as Employee (Demo)
          </button>
          <p className="text-xs text-gray-400 text-center">
            Manager: Alice Johnson · Employee: Bob Smith
          </p>
        </div>
      </div>
    </div>
  );
}
