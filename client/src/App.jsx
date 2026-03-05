import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import SchedulePage from './pages/SchedulePage';
import EmployeesPage from './pages/EmployeesPage';
import SwapsPage from './pages/SwapsPage';
import ProfilePage from './pages/ProfilePage';
import { Badge } from './components/ui';

function roleVariant(role) {
  const map = {
    Manager: 'manager',
    Server:  'server',
    Kitchen: 'kitchen',
    Bar:     'bar',
    Host:    'host',
  };
  return map[role] ?? 'default';
}

/* ── Nav icon components ── */
function DashboardIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function ScheduleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M7 2v4M13 2v4M3 9h14" />
    </svg>
  );
}
function EmployeesIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="6" r="3" />
      <path d="M2 18c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <path d="M14 4c1.657 0 3 1.343 3 3s-1.343 3-3 3" strokeDasharray="2 1" />
      <path d="M17 14c1.105 0.552 1.88 1.71 2 3" />
    </svg>
  );
}
function SwapIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h12M4 6l3-3M4 6l3 3" />
      <path d="M16 14H4M16 14l-3-3M16 14l-3 3" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="7" r="3" />
      <path d="M4 18c0-3.314 2.686-6 6-6s6 2.686 6 6" />
    </svg>
  );
}

export default function App() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Loading ShiftSync…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const NAV_ITEMS = [
    { to: '/',          label: 'Dashboard', icon: <DashboardIcon /> },
    { to: '/schedule',  label: 'Schedule',  icon: <ScheduleIcon /> },
    ...(user.isManager ? [{ to: '/employees', label: 'Employees', icon: <EmployeesIcon /> }] : []),
    { to: '/swaps',      label: 'Shift Swaps', icon: <SwapIcon /> },
    { to: '/profile',   label: 'My Profile',  icon: <ProfileIcon /> },
  ];

  const initials = (user.employeeName || user.username)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Top Navigation Bar ── */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between gap-6">

          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
              <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <span className="text-base font-bold text-foreground tracking-tight">ShiftSync</span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              {user.employeeRole && (
                <Badge variant={roleVariant(user.employeeRole)} className="text-xs">{user.employeeRole}</Badge>
              )}
              <span className="text-sm font-medium text-foreground">{user.employeeName || user.username}</span>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center border border-primary/20 hover:bg-primary/20 transition-colors"
              title="View profile"
            >
              {initials}
            </button>
            <button
              onClick={logout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60"
              title="Sign out"
            >
              Sign out
            </button>
          </div>

        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-[1280px] mx-auto w-full px-6 py-6">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/schedule"   element={<SchedulePage />} />
          {user.isManager && <Route path="/employees" element={<EmployeesPage />} />}
          <Route path="/swaps"      element={<SwapsPage />} />
          <Route path="/profile"    element={<ProfilePage />} />
        </Routes>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-white">
        <div className="max-w-[1280px] mx-auto px-6 h-10 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">ShiftSync © 2025</span>
          <span className="text-xs text-muted-foreground">Smart scheduling for hospitality</span>
        </div>
      </footer>

    </div>
  );
}

