import { Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import SchedulePage from './pages/SchedulePage';
import EmployeesPage from './pages/EmployeesPage';
import SwapsPage from './pages/SwapsPage';
import { Badge, Button } from './components/ui';
import type { BadgeVariant } from './components/ui';

function roleVariant(role: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    Manager: 'manager',
    Server: 'server',
    Kitchen: 'kitchen',
    Bar: 'bar',
    Host: 'host',
  };
  return map[role] ?? 'default';
}

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
                  <Badge variant={roleVariant(user.employeeRole)}>{user.employeeRole}</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-blue-200 hover:text-white hover:bg-blue-600"
                title="Sign out"
              >
                Sign out
              </Button>
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