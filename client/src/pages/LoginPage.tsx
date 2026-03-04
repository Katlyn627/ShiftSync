import { useState } from 'react';
import { useAuth } from '../AuthContext';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-4xl">⏰</span>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">ShiftSync</h1>
          <p className="text-gray-500 text-sm mt-1">Smart Scheduling + Burnout Prevention</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              required
              autoComplete="username"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. alice"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
          <p className="font-semibold text-gray-700 mb-2">Demo Accounts (password: password123)</p>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1"></span>
              <strong>alice</strong> — Manager
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
              <strong>bob</strong> — Server
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
              <strong>carol</strong> — Server
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1"></span>
              <strong>eve</strong> — Kitchen
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
              <strong>henry</strong> — Bar
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-pink-500 mr-1"></span>
              <strong>jack</strong> — Host
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
