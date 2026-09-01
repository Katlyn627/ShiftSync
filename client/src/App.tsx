import {
  BarChart3,
  Bell,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Repeat2,
  UserCircle2,
  Users,
} from 'lucide-react';
import { lazy, Suspense, type ComponentType } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import UserMenu from './components/layout/UserMenu';
import LoginPage from './pages/LoginPage';
import RegisterBusinessPage from './pages/RegisterBusinessPage';
import { Badge, Logo, BusinessLogo } from './components/ui';

export { Logo as ShiftSyncLogo };

const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const OpenShiftsPage = lazy(() => import('./pages/OpenShiftsPage'));
const FairnessPage = lazy(() => import('./pages/FairnessPage'));
const SurveysPage = lazy(() => import('./pages/SurveysPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const TimeOffApprovalsPage = lazy(() => import('./pages/TimeOffApprovalsPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const SwapsPage = lazy(() => import('./pages/SwapsPage'));

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
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/schedule', label: 'Schedule', icon: CalendarDays },
        { to: '/open-shifts', label: 'Open Shifts', icon: ClipboardList },
        { to: '/surveys', label: 'Surveys', icon: FileText },
        { to: '/fairness', label: 'Fairness', icon: BarChart3 },
        { to: '/time-off-approvals', label: 'Time Off', icon: CalendarCheck2 },
        { to: '/employees', label: 'Employees', icon: Users },
        { to: '/swaps', label: 'Shift Swaps', icon: Repeat2 },
      ]
    : [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/schedule', label: 'My Schedule', icon: CalendarDays },
        { to: '/open-shifts', label: 'Open Shifts', icon: ClipboardList },
        { to: '/surveys', label: 'Surveys', icon: FileText },
        { to: '/profile', label: 'Profile', icon: UserCircle2 },
        { to: '/time-off', label: 'Time Off', icon: CalendarCheck2 },
        { to: '/swaps', label: 'Shift Swaps', icon: Repeat2 },
      ];

  const routeLoadingFallback = (
    <div role="status" aria-live="polite" aria-label="Loading page content" className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
      Loading page content...
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1280px] rounded-[28px] border border-white/60 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-3rem)]">
        <aside className="hidden w-[260px] shrink-0 border-r border-border/80 px-5 py-6 lg:flex lg:flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-sm leading-tight tracking-tight">ShiftSync</span>
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Humanitarian OS</span>
              </div>
            </div>

            {/* Active Business Brand Card */}
            <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 shadow-2xs">
              <BusinessLogo siteName="Global Impact Initiative" siteType="nonprofit" size={32} withText={true} />
            </div>

            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Menu</p>
            <nav className="mt-2 space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-primary/10 text-primary font-semibold shadow-[inset_3px_0_0_0_var(--color-primary)]'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border/70 px-4 py-3.5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="lg:hidden flex items-center gap-2">
                  <Logo size={24} />
                </div>
                <div className="hidden sm:block">
                  <BusinessLogo siteName="Global Impact Initiative" siteType="nonprofit" size={28} withText={true} />
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-muted-foreground hover:text-foreground shadow-2xs transition-colors" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                </button>
                <UserMenu user={user} onLogout={logout} />
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
            <Suspense fallback={routeLoadingFallback}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/schedule" element={<SchedulePage />} />
                <Route path="/open-shifts" element={<OpenShiftsPage />} />
                <Route path="/surveys" element={<SurveysPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/time-off" element={<ProfilePage />} />
                {user.isManager && <Route path="/fairness" element={<FairnessPage />} />}
                {user.isManager && <Route path="/time-off-approvals" element={<TimeOffApprovalsPage />} />}
                {user.isManager && <Route path="/employees" element={<EmployeesPage />} />}
                {user.isManager ? null : <Route path="/employees" element={<Navigate to="/dashboard" replace />} />}
                <Route path="/swaps" element={<SwapsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
