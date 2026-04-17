import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterBusinessPage from './pages/RegisterBusinessPage';
import SchedulePage from './pages/SchedulePage';
import EmployeesPage from './pages/EmployeesPage';
import { Badge, Logo } from './components/ui';

export { Logo as ShiftSyncLogo };

export default function App() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Logo size={48} />
          <p className="text-sm text-muted-foreground font-medium">Loading ShiftSync…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/register-business" element={<RegisterBusinessPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  const navItems = user.isManager
    ? [
        { to: '/schedule', label: 'Schedule' },
        { to: '/employees', label: 'Employees' },
      ]
    : [
        { to: '/schedule', label: 'My Schedule' },
      ];

  const initials = (user.employeeName || user.username)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-semibold text-foreground">ShiftSync</span>
            <Badge variant="outline">Scheduling</Badge>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <button
              className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/schedule" replace />} />
          <Route path="/schedule" element={<SchedulePage />} />
          {user.isManager && <Route path="/employees" element={<EmployeesPage />} />}
          <Route path="*" element={<Navigate to="/schedule" replace />} />
        </Routes>
      </main>
    </div>
  );
}
