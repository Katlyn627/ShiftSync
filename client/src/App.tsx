import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useState, useEffect, useCallback } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterBusinessPage from './pages/RegisterBusinessPage';
import Dashboard from './pages/Dashboard';
import SchedulePage from './pages/SchedulePage';
import EmployeesPage from './pages/EmployeesPage';
import SwapsPage from './pages/SwapsPage';
import ProfilePage from './pages/ProfilePage';
import TimeOffApprovalsPage from './pages/TimeOffApprovalsPage';
import OpenShiftsPage from './pages/OpenShiftsPage';
import FairnessPage from './pages/FairnessPage';
import SurveysPage from './pages/SurveysPage';
import { Badge } from './components/ui';
import type { BadgeVariant } from './components/ui';
import { getSites, Site } from './api';

function roleVariant(role: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    Manager: 'manager',
    Server:  'server',
    Kitchen: 'kitchen',
    Bar:     'bar',
    Host:    'host',
  };
  return map[role] ?? 'default';
}

/* ── ShiftSync brand logo mark (sync arrows) ── */
function ShiftSyncLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="ShiftSync logo">
      <rect width="32" height="32" rx="9" fill="url(#logo-grad)" />
      <path d="M9.5 12.5C10.8 9.5 13.7 7.5 17 7.5c3 0 5.6 1.6 7 4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <polyline points="21,10 24,11.5 22.5,8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M22.5 19.5C21.2 22.5 18.3 24.5 15 24.5c-3 0-5.6-1.6-7-4" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <polyline points="11,22 8,20.5 9.5,24" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5046E4"/>
          <stop offset="60%" stopColor="#7C3AED"/>
          <stop offset="100%" stopColor="#0891B2"/>
        </linearGradient>
      </defs>
    </svg>
  );
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
function TimeOffIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M7 2v4M13 2v4M3 9h14" />
      <path d="M7 13l2 2 4-4" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export { ShiftSyncLogo };

export default function App() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [currentSite, setCurrentSite] = useState<Site | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shiftsync-theme') === 'dark' ||
        (!localStorage.getItem('shiftsync-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('shiftsync-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('shiftsync-theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (user?.siteId) {
      getSites().then(sites => {
        const site = sites.find(s => s.id === user.siteId);
        setCurrentSite(site ?? null);
      }).catch(() => {});
    } else {
      setCurrentSite(null);
    }
  }, [user?.siteId]);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse">
            <ShiftSyncLogo size={48} />
          </div>
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

  const NAV_ITEMS = [
    { to: '/',                    label: 'Dashboard',   icon: <DashboardIcon />, color: '#5046E4' },
    { to: '/schedule',            label: 'Schedule',    icon: <ScheduleIcon />,  color: '#0D9488' },
    ...(user.isManager ? [{ to: '/employees',           label: 'Employees',   icon: <EmployeesIcon />, color: '#7C3AED' }] : []),
    { to: '/swaps',               label: 'Shift Swaps', icon: <SwapIcon />,      color: '#F97316' },
    { to: '/open-shifts',         label: 'Open Shifts', icon: <SwapIcon />,      color: '#0EA5E9' },
    { to: '/surveys',             label: 'Surveys',     icon: <ProfileIcon />,   color: '#EC4899' },
    ...(user.isManager ? [{ to: '/time-off-approvals',  label: 'Time-Off',    icon: <TimeOffIcon />,   color: '#059669' }] : []),
    ...(user.isManager ? [{ to: '/fairness',            label: 'Fairness',    icon: <DashboardIcon />, color: '#8B5CF6' }] : []),
  ];

  const initials = (user.employeeName || user.username)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Top Navigation Bar ── */}
      <header className="bg-card border-b border-border sticky top-0 z-40 shadow-sm shadow-border/40">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <ShiftSyncLogo size={32} />
            <div className="flex flex-col leading-none">
              <span className="text-base font-extrabold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>ShiftSync</span>
              {currentSite && (
                <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[140px] hidden sm:block">
                  {currentSite.name} · {currentSite.city}, {currentSite.state}
                </span>
              )}
            </div>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto flex-1 justify-center">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { color: item.color, background: `${item.color}18` }
                    : {}
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right section: dark mode + user */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(d => !d)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* User info (desktop) */}
            <div className="hidden sm:flex items-center gap-2">
              {user.employeeRole && (
                <Badge variant={roleVariant(user.employeeRole)} className="text-xs">{user.employeeRole}</Badge>
              )}
              <span className="text-sm font-medium text-foreground max-w-[100px] truncate">{user.employeeName || user.username}</span>
            </div>

            {/* Profile avatar */}
            <button
              onClick={() => { navigate('/profile'); closeMobileMenu(); }}
              className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/30 hover:border-primary/60 transition-all shrink-0"
              title="View profile"
            >
              {user.photoUrl ? (
                <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {initials}
                </div>
              )}
            </button>

            {/* Sign out (desktop) */}
            <button
              onClick={logout}
              className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60"
              title="Sign out"
            >
              Sign out
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>

        </div>
      </header>

      {/* ── Mobile Overlay Drawer ── */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="mobile-drawer-overlay md:hidden"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div className="mobile-drawer md:hidden flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <ShiftSyncLogo size={28} />
                <span className="text-base font-extrabold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>ShiftSync</span>
              </div>
              <button
                onClick={closeMobileMenu}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="Close menu"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive ? 'font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? { color: item.color, background: `${item.color}15` }
                      : {}
                  }
                >
                  {/* Color dot indicator */}
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 opacity-80"
                    style={{ background: item.color }}
                    aria-hidden="true"
                  />
                  <span className="w-5 flex justify-center shrink-0">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Drawer footer: user info + sign out */}
            <div className="px-4 pb-6 pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-3 px-1">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/30 shrink-0">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {initials}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user.employeeName || user.username}</p>
                  {user.employeeRole && (
                    <Badge variant={roleVariant(user.employeeRole)} className="text-xs mt-0.5">{user.employeeRole}</Badge>
                  )}
                </div>
              </div>
              <button
                onClick={() => { logout(); closeMobileMenu(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-border"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-[1280px] mx-auto w-full px-4 sm:px-6 py-6">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/schedule"   element={<SchedulePage />} />
          {user.isManager && <Route path="/employees" element={<EmployeesPage />} />}
          <Route path="/swaps"      element={<SwapsPage />} />
          <Route path="/profile"    element={<ProfilePage />} />
          {user.isManager && <Route path="/time-off-approvals" element={<TimeOffApprovalsPage />} />}
          <Route path="/open-shifts" element={<OpenShiftsPage />} />
          <Route path="/surveys"    element={<SurveysPage />} />
          <Route path="/fairness"   element={user.isManager ? <FairnessPage /> : <Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShiftSyncLogo size={16} />
            <span className="text-xs text-muted-foreground font-medium" style={{ fontFamily: 'var(--font-heading)' }}>ShiftSync © 2025</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">Smart scheduling for hospitality</span>
        </div>
      </footer>

    </div>
  );
}

