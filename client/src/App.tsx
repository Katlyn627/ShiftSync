import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Dashboard from './pages/Dashboard';
import SchedulePage from './pages/SchedulePage';
import EmployeesPage from './pages/EmployeesPage';
import SwapsPage from './pages/SwapsPage';
import LoginPage from './pages/LoginPage';

const NAV_ITEMS = [
  { to: '/', label: '📊 Dashboard' },
  { to: '/schedule', label: '📅 Schedule' },
  { to: '/employees', label: '👥 Employees' },
  { to: '/swaps', label: '🔄 Shift Swaps' },
];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppShell() {
  const { user, logout, isManager } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <span className="text-xl font-bold tracking-tight">ShiftSync</span>
            <span className="text-blue-200 text-sm hidden sm:block">Smart Scheduling + Burnout Prevention</span>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-1">
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
            </nav>
            {user && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-blue-500">
                <span className="text-xs text-blue-200 hidden md:block">
                  {user.displayName}
                  {isManager && (
                    <span className="ml-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full font-medium">Manager</span>
                  )}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs text-blue-200 hover:text-white px-2 py-1 rounded hover:bg-blue-600"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
          <Route path="/swaps" element={<ProtectedRoute><SwapsPage /></ProtectedRoute>} />
        </Routes>
      </main>
      <footer className="text-center text-gray-400 text-xs py-3 border-t">
        ShiftSync © 2025 — Smart scheduling for hospitality
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
