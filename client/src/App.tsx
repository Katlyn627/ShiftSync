import { Bell, CalendarDays, ChevronDown, Repeat2, Search, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterBusinessPage from './pages/RegisterBusinessPage';
import SchedulePage from './pages/SchedulePage';
import EmployeesPage from './pages/EmployeesPage';
import SwapsPage from './pages/SwapsPage';
import { Badge, Logo } from './components/ui';

export { Logo as ShiftSyncLogo };

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

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

  const navItems: NavItem[] = user.isManager
    ? [
        { to: '/schedule', label: 'Schedule', icon: CalendarDays },
        { to: '/employees', label: 'Employees', icon: Users },
        { to: '/swaps', label: 'Shift Swaps', icon: Repeat2 },
      ]
    : [
        { to: '/schedule', label: 'My Schedule', icon: CalendarDays },
        { to: '/swaps', label: 'Shift Swaps', icon: Repeat2 },
      ];

  const initials = (user.employeeName || user.username)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1280px] rounded-[28px] border border-white/60 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-3rem)]">
        <aside className="hidden w-[248px] shrink-0 border-r border-border/80 px-5 py-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-semibold text-foreground">ShiftSync</span>
            <Badge variant="outline" className="text-[10px]">Scheduling</Badge>
          </div>
          <p className="mt-6 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Menu</p>
          <nav className="mt-2 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                      isActive
                        ? 'bg-primary/10 text-primary shadow-[inset_2px_0_0_0_var(--color-primary)]'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/85 to-cyan-500 p-4 text-white shadow-lg">
            <p className="text-sm font-semibold">ShiftSync Pro</p>
            <p className="mt-1 text-xs text-white/85">Unlock advanced scheduling and smart auto-fill tools.</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border/70 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="hidden max-w-sm flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-left md:flex"
                aria-label="Search coming soon"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="w-full text-sm text-muted-foreground">Search coming soon</span>
                <Badge variant="outline" className="text-[10px]">⌘F</Badge>
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-muted-foreground hover:text-foreground" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                </button>
                <button type="button" className="flex items-center gap-2 rounded-full border border-border bg-white px-2.5 py-1.5" aria-label="User menu">
                  <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[11px] font-bold">
                    {initials}
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted" onClick={logout}>
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-auto bg-muted/30 p-4 sm:p-6">
            <nav className="mb-4 flex gap-2 overflow-x-auto rounded-xl border border-border bg-white p-2 lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={`mobile-${item.to}`}
                    to={item.to}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs ${
                        isActive ? 'bg-primary text-white' : 'bg-muted/70 text-muted-foreground'
                      }`
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <Routes>
              <Route path="/" element={<Navigate to="/schedule" replace />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/swaps" element={<SwapsPage />} />
              {user.isManager && <Route path="/employees" element={<EmployeesPage />} />}
              <Route path="*" element={<Navigate to="/schedule" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
