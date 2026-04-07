import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useState, useEffect, useCallback, useRef } from 'react';
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
import MessagingPage from './pages/MessagingPage';
import BrandAssetsPage from './pages/BrandAssetsPage';
import { Badge, Logo } from './components/ui';
import type { BadgeVariant } from './components/ui';
import { getSites, Site, getNotifications, markAllNotificationsRead, markNotificationRead, AppNotification, offerForOpenShift } from './api';

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
function MessagesIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5A1.5 1.5 0 013.5 3h13A1.5 1.5 0 0118 4.5v8A1.5 1.5 0 0116.5 14H11l-3 3v-3H3.5A1.5 1.5 0 012 12.5v-8z"/>
    </svg>
  );
}

export { Logo as ShiftSyncLogo };

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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [claimingShiftId, setClaimingShiftId] = useState<number | null>(null);

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

  // Poll for notifications every 15 seconds
  useEffect(() => {
    const NOTIFICATION_POLL_INTERVAL_MS = 15000;
    if (!user) return;
    const fetchNotifs = () => {
      getNotifications().then(({ notifications: n, unread_count: uc }) => {
        setNotifications(n);
        setUnreadCount(uc);
      }).catch(() => {});
    };
    fetchNotifs();
    notifPollRef.current = setInterval(fetchNotifs, NOTIFICATION_POLL_INTERVAL_MS);
    return () => { if (notifPollRef.current) clearInterval(notifPollRef.current); };
  }, [user]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse">
            <Logo size={48} />
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

  const NAV_ITEMS = user.isManager
    ? [
        { to: '/',                   label: 'Dashboard',   icon: <DashboardIcon />, color: '#5046E4' },
        { to: '/schedule',           label: 'Schedule',    icon: <ScheduleIcon />,  color: '#0D9488' },
        { to: '/employees',          label: 'Employees',   icon: <EmployeesIcon />, color: '#7C3AED' },
        { to: '/swaps',              label: 'Shift Swaps', icon: <SwapIcon />,      color: '#F97316' },
        { to: '/open-shifts',        label: 'Open Shifts', icon: <SwapIcon />,      color: '#0EA5E9' },
        { to: '/messages',           label: 'Messages',    icon: <MessagesIcon />,  color: '#8B5CF6' },
        { to: '/surveys',            label: 'Surveys',     icon: <ProfileIcon />,   color: '#EC4899' },
        { to: '/time-off-approvals', label: 'Time-Off',    icon: <TimeOffIcon />,   color: '#059669' },
        { to: '/fairness',           label: 'Fairness',    icon: <DashboardIcon />, color: '#8B5CF6' },
      ]
    : [
        { to: '/',            label: 'Dashboard',   icon: <DashboardIcon />, color: '#5046E4' },
        { to: '/schedule',    label: 'Schedule',    icon: <ScheduleIcon />,  color: '#0D9488' },
        { to: '/open-shifts', label: 'Open Shifts', icon: <SwapIcon />,      color: '#0EA5E9' },
        { to: '/swaps',       label: 'Shift Swaps', icon: <SwapIcon />,      color: '#F97316' },
        { to: '/messages',    label: 'Messages',    icon: <MessagesIcon />,  color: '#8B5CF6' },
        { to: '/surveys',     label: 'Surveys',     icon: <ProfileIcon />,   color: '#EC4899' },
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

        {/* ── Row 1: Brand (centered) + utility controls ── */}
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 relative flex items-center">

          {/* Mobile hamburger – left side on small screens */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          {/* Centered brand – absolutely positioned so it stays true-center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={() => navigate('/')}
              className="flex flex-col items-center gap-0.5 pointer-events-auto hover:opacity-80 transition-opacity"
              aria-label="Go to dashboard"
            >
              <Logo size={30} />
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-sm font-extrabold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>ShiftSync</span>
                {currentSite && (
                  <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                    · {currentSite.name}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Right: utility controls */}
          <div className="flex items-center gap-2 ml-auto relative z-10">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(d => !d)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors relative"
                title="Notifications"
                aria-label="Notifications"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M10 2a6 6 0 00-6 6v2.586l-1.707 1.707A1 1 0 003 14h14a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6z"/>
                  <path d="M8 14a2 2 0 004 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          markAllNotificationsRead().then(() => {
                            setUnreadCount(0);
                            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
                          });
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-muted-foreground text-sm">No notifications</div>
                    ) : (
                      notifications.slice(0, 20).map(n => {
                        const notifData = (() => { try { return JSON.parse(n.data || '{}'); } catch (e) { console.error('Failed to parse notification data', e); return {}; } })();
                        const isPickupNotif = (n.type === 'shift_pickup_needed' || n.type === 'open_shift_available') && notifData.open_shift_id;
                        const isSwapRequest = n.type === 'swap_request_received' || n.type === 'swap_request_created';
                        const isSwapApproved = n.type === 'swap_approved';
                        const isSwapRejected = n.type === 'swap_rejected';
                        const isDropRequest = n.type === 'shift_drop_request';

                        const handleMarkRead = () => {
                          if (!n.read_at) {
                            markNotificationRead(n.id).then(() => {
                              setUnreadCount(prev => Math.max(0, prev - 1));
                              setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
                            });
                          }
                        };

                        return (
                          <div
                            key={n.id}
                            className={`px-4 py-3 flex gap-3 items-start ${!n.read_at ? 'bg-primary/5' : ''}`}
                          >
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read_at ? 'bg-primary' : 'bg-transparent'}`} />
                            <div className="min-w-0 flex-1">
                              <button
                                className="w-full text-left hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  handleMarkRead();
                                  if (n.link) { navigate(n.link); setNotifOpen(false); }
                                }}
                              >
                                <p className="text-sm font-medium leading-snug">{n.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </button>
                              {isPickupNotif && (
                                <button
                                  className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors disabled:opacity-60"
                                  disabled={claimingShiftId === notifData.open_shift_id}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setClaimingShiftId(notifData.open_shift_id);
                                    try {
                                      await offerForOpenShift(notifData.open_shift_id);
                                      handleMarkRead();
                                      navigate('/open-shifts');
                                      setNotifOpen(false);
                                    } catch (err: any) {
                                      const errMsg = err?.message ?? 'Could not claim shift';
                                      alert(errMsg + '\n\nGo to Open Shifts to try again.');
                                      navigate('/open-shifts');
                                      setNotifOpen(false);
                                    } finally {
                                      setClaimingShiftId(null);
                                    }
                                  }}
                                >
                                  {claimingShiftId === notifData.open_shift_id ? 'Claiming…' : '✋ Claim This Shift'}
                                </button>
                              )}
                              {(isSwapRequest || isDropRequest) && (
                                <button
                                  className="mt-2 w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkRead();
                                    navigate('/swaps');
                                    setNotifOpen(false);
                                  }}
                                >
                                  🔄 Review Request
                                </button>
                              )}
                              {isSwapApproved && (
                                <button
                                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkRead();
                                    navigate('/schedule');
                                    setNotifOpen(false);
                                  }}
                                >
                                  📅 View My Schedule
                                </button>
                              )}
                              {isSwapRejected && (
                                <button
                                  className="mt-2 w-full bg-slate-500 hover:bg-slate-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkRead();
                                    navigate('/swaps');
                                    setNotifOpen(false);
                                  }}
                                >
                                  👁 View Swap History
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

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
          </div>

        </div>

        {/* ── Row 2: Desktop navigation bar ── */}
        {/* Note: label visibility is controlled at the row level (hidden md:block),
            so individual nav items always render their full text labels here. */}
        <div className="hidden md:block border-t border-border/50">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
            <nav className="flex items-center justify-center gap-1 h-10 overflow-x-auto" aria-label="Main navigation">
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
                  title={item.label}
                  aria-label={item.label}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
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
                <Logo size={28} />
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
          <Route path="/messages"   element={<MessagingPage />} />
          <Route path="/surveys"    element={<SurveysPage />} />
          <Route path="/fairness"   element={user.isManager ? <FairnessPage /> : <Navigate to="/" replace />} />
          <Route path="/brand-assets" element={<BrandAssetsPage />} />
          {/* Catch-all: redirect unknown/post-login URLs (e.g. /login) to Dashboard */}
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={16} />
            <span className="text-xs text-muted-foreground font-medium" style={{ fontFamily: 'var(--font-heading)' }}>ShiftSync © 2025</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">Smart scheduling for hospitality</span>
        </div>
      </footer>

    </div>
  );
}

