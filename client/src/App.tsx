import { Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import SchedulePage from './pages/SchedulePage';
import EmployeesPage from './pages/EmployeesPage';
import SwapsPage from './pages/SwapsPage';

const ROLE_BADGE: Record<string, string> = {
  Manager: 'bg-purple-200 text-purple-800',
  Server: 'bg-blue-200 text-blue-800',
  Kitchen: 'bg-orange-200 text-orange-800',
  Bar: 'bg-green-200 text-green-800',
  Host: 'bg-pink-200 text-pink-800',
};

export default function App() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const NAV_ITEMS = [
    { to: '/', label: '📊 Dashboard' },
    { to: '/schedule', label: '📅 Schedule' },
    ...(user.isManager ? [{ to: '/employees', label: '👥 Employees' }] : []),
    { to: '/swaps', label: '🔄 Shift Swaps' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <span className="text-xl font-bold tracking-tight">ShiftSync</span>
            <span className="text-blue-200 text-sm hidden sm:block">Smart Scheduling + Burnout Prevention</span>
          </div>
          <nav className="flex gap-1 items-center">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive ? 'bg-white text-blue-700' : 'text-blue-100 hover:bg-blue-600'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="ml-3 flex items-center gap-2 pl-3 border-l border-blue-500">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium leading-tight">{user.employeeName || user.username}</div>
                {user.employeeRole && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[user.employeeRole] || 'bg-blue-200 text-blue-800'}`}>
                    {user.employeeRole}
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                className="text-blue-200 hover:text-white text-sm px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedule" element={<SchedulePage />} />
          {user.isManager && <Route path="/employees" element={<EmployeesPage />} />}
          <Route path="/swaps" element={<SwapsPage />} />
        </Routes>
      </main>
      <footer className="text-center text-gray-400 text-xs py-3 border-t">
        ShiftSync © 2025 — Smart scheduling for hospitality
      </footer>
    </div>
  );
}