import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import {
  getSchedules, getLaborCost, getBurnoutRisks, getStaffingSuggestions,
  getEmployees, getScheduleShifts, getAvailability,
  getProfitabilityMetrics, getRestaurantSettings, updateRestaurantSettings, getSites,
  getPosIntegrations,
  getConversations, getSwaps, getSurveyCampaigns, getNotifications, markNotificationRead,
  offerForOpenShift, markAllNotificationsRead,
  Schedule, LaborCostSummary, BurnoutRisk, DailyStaffingSuggestion, Employee, ShiftWithEmployee, Availability,
  ProfitabilityMetrics, RestaurantSettings, DayRevenue, DaypartRevenue, Site, PosIntegration,
  ConversationWithDetails, SwapWithDetails, SurveyCampaign, AppNotification,
} from '../api';
import { useAuth } from '../AuthContext';
import { Card, Badge, Modal, NATIVE_SELECT_CLASS, PageHeader, useToast } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

const RISK_COLORS: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#10b981',
};

function riskVariant(level: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = { high: 'danger', medium: 'warning', low: 'success' };
  return map[level] ?? 'default';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── Employee avatar helpers (consistent with EmployeesPage) ── */
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_BG: Record<string, string> = {
  Manager:     'bg-violet-100 text-violet-700',
  Server:      'bg-blue-100 text-blue-700',
  Kitchen:     'bg-orange-100 text-orange-700',
  Bar:         'bg-emerald-100 text-emerald-700',
  Host:        'bg-pink-100 text-pink-700',
  'Front Desk': 'bg-sky-100 text-sky-700',
  Housekeeping:'bg-amber-100 text-amber-700',
  'F&B':       'bg-lime-100 text-lime-700',
  Maintenance: 'bg-gray-100 text-gray-700',
};

/* ── Shift duration helpers ── */
function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftHours(start: string, end: string): number {
  const startMin = parseMinutes(start);
  let endMin = parseMinutes(end);
  if (endMin < startMin) endMin += 24 * 60;
  return (endMin - startMin) / 60;
}

/* ── Role-to-badge-variant mapping (consistent with EmployeesPage) ── */
const ROLE_BADGE_VARIANT: Record<string, BadgeVariant> = {
  Manager: 'manager', Server: 'server', Kitchen: 'kitchen', Bar: 'bar', Host: 'host',
};

/* ── Employee shift cost / hours helpers ── */
function calculateEmployeeLaborCost(shifts: ShiftWithEmployee[]): number {
  return shifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time) * s.hourly_rate, 0);
}

function calculateTotalHours(shifts: ShiftWithEmployee[]): number {
  return shifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0);
}

/* ── Turnover risk derived from burnout ── */
function getTurnoverRisk(burnoutRisk: BurnoutRisk | undefined): { level: 'low' | 'medium' | 'high'; reason: string } {
  if (!burnoutRisk) return { level: 'low', reason: 'No schedule data for this week' };
  if (burnoutRisk.risk_level === 'high') return { level: 'high', reason: 'High burnout risk strongly correlates with turnover intent' };
  if (burnoutRisk.risk_level === 'medium') return { level: 'medium', reason: 'Moderate stress factors may affect long-term retention' };
  return { level: 'low', reason: 'Schedule conditions suggest stable retention' };
}

/** POS platform branding — matches SchedulePage */
const POS_PLATFORM_STYLES: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  square:     { label: 'Square',     color: '#00b9a9', bg: '#e6f9f7', icon: '◼' },
  toast:      { label: 'Toast',      color: '#ff6b35', bg: '#fff0eb', icon: '🍞' },
  clover:     { label: 'Clover',     color: '#1a9e5a', bg: '#e8f8ef', icon: '🍀' },
  lightspeed: { label: 'Lightspeed', color: '#e63c2f', bg: '#fdecea', icon: '⚡' },
  revel:      { label: 'Revel',      color: '#7b5ea7', bg: '#f3edfb', icon: '🎯' },
  other:      { label: 'POS',        color: '#6b7280', bg: '#f3f4f6', icon: '🔗' },
};

/* ── KPI Card ── */
function KpiCard({
  label, value, sub, trend, icon,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {sub && (
          <p className={`text-xs mt-1 ${
            trend === 'up'   ? 'text-emerald-600' :
            trend === 'down' ? 'text-red-500'     : 'text-muted-foreground'
          }`}>{sub}</p>
        )}
      </div>
    </Card>
  );
}

/* ── Inline SVG icons ── */
function DollarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isManager = user?.isManager ?? false;
  const [schedules, setSchedules]                   = useState<Schedule[]>([]);
  const [selectedId, setSelectedId]                 = useState<number | null>(null);
  const [laborCost, setLaborCost]                   = useState<LaborCostSummary | null>(null);
  const [burnout, setBurnout]                       = useState<BurnoutRisk[]>([]);
  const [staffingSuggestions, setStaffingSuggestions] = useState<DailyStaffingSuggestion[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [employees, setEmployees]                   = useState<Employee[]>([]);
  const [scheduleShifts, setScheduleShifts]         = useState<ShiftWithEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee]     = useState<Employee | null>(null);
  const [employeeAvailability, setEmployeeAvailability] = useState<Availability[]>([]);
  const [profitabilityMetrics, setProfitabilityMetrics] = useState<ProfitabilityMetrics | null>(null);
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings | null>(null);
  const [showSettingsModal, setShowSettingsModal]   = useState(false);
  const [settingsForm, setSettingsForm]             = useState<RestaurantSettings>({
    seats: 60, tables: 15, cogs_pct: 30, target_labor_pct: 30, operating_hours_per_day: 12,
  });
  const [settingsSaving, setSettingsSaving]         = useState(false);
  const [currentSite, setCurrentSite]               = useState<Site | null>(null);
  const [posIntegrations, setPosIntegrations]       = useState<PosIntegration[]>([]);
  const [conversations, setConversations]           = useState<ConversationWithDetails[]>([]);
  const [pendingSwaps, setPendingSwaps]             = useState<SwapWithDetails[]>([]);
  const [activeSurveys, setActiveSurveys]           = useState<SurveyCampaign[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<AppNotification[]>([]);
  const [claimingShiftId, setClaimingShiftId]       = useState<number | null>(null);

  useEffect(() => {
    getSchedules().then(s => {
      setSchedules(s);
      if (s.length > 0) setSelectedId(s[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
    getEmployees().then(setEmployees).catch(() => setEmployees([]));
    if (isManager) {
      getRestaurantSettings().then(s => {
        setRestaurantSettings(s);
        setSettingsForm(s);
      }).catch(() => {});
      getPosIntegrations().then(setPosIntegrations).catch(() => setPosIntegrations([]));
    }
    if (user?.siteId) {
      getSites().then(sites => {
        const site = sites.find(s => s.id === user.siteId);
        setCurrentSite(site ?? null);
      }).catch(() => {});
    }
  }, [isManager, user?.siteId]);

  useEffect(() => {
    if (!selectedEmployee) { setEmployeeAvailability([]); return; }
    getAvailability(selectedEmployee.id).then(setEmployeeAvailability).catch(() => setEmployeeAvailability([]));
  }, [selectedEmployee]);

  useEffect(() => {
    if (!selectedId) return;
    if (isManager) getLaborCost(selectedId).then(setLaborCost).catch(() => setLaborCost(null));
    if (isManager) getProfitabilityMetrics(selectedId).then(setProfitabilityMetrics).catch(() => setProfitabilityMetrics(null));
    getBurnoutRisks(selectedId).then(setBurnout).catch(() => setBurnout([]));
    getScheduleShifts(selectedId).then(setScheduleShifts).catch(() => setScheduleShifts([]));
  }, [selectedId, isManager]);

  useEffect(() => {
    if (!isManager) return;
    const schedule = schedules.find(s => s.id === selectedId);
    if (!schedule) return;
    getStaffingSuggestions(schedule.week_start)
      .then(setStaffingSuggestions)
      .catch(() => setStaffingSuggestions([]));
  }, [selectedId, schedules, isManager]);

  // Fetch employee hub data (conversations, swaps, surveys, notifications) for all users
  useEffect(() => {
    getConversations().then(setConversations).catch(() => setConversations([]));
    getSwaps().then(swaps => {
      setPendingSwaps(swaps.filter(s => s.status === 'pending'));
    }).catch(() => setPendingSwaps([]));
    getSurveyCampaigns().then(campaigns => {
      setActiveSurveys(campaigns.filter(c => c.status === 'active'));
    }).catch(() => setActiveSurveys([]));
    getNotifications({ unread_only: true }).then(({ notifications }) => {
      setRecentNotifications(notifications.slice(0, 5));
    }).catch(() => setRecentNotifications([]));
  }, []);

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsSaving(true);
    updateRestaurantSettings(settingsForm)
      .then(s => {
        setRestaurantSettings(s);
        setSettingsForm(s);
        setShowSettingsModal(false);
        toast('Restaurant settings saved.', { variant: 'success' });
        // Refresh metrics after settings change
        if (selectedId) getProfitabilityMetrics(selectedId).then(setProfitabilityMetrics).catch(() => {});
      })
      .catch(() => { toast('Failed to save settings.', { variant: 'error' }); })
      .finally(() => setSettingsSaving(false));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading dashboard…
      </div>
    );
  }

  const noSchedules = schedules.length === 0;
  const highRisk   = burnout.filter(b => b.risk_level === 'high');
  const mediumRisk = burnout.filter(b => b.risk_level === 'medium');
  const budgetPct  = laborCost ? (laborCost.projected_cost / laborCost.labor_budget) * 100 : 0;
  const overBudget = laborCost && laborCost.variance > 0;
  const myShifts   = scheduleShifts.filter(s => s.employee_id === user?.employeeId);

  const totalUnread       = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const unreadFromManagers = conversations
    .filter(c => c.members.some(m => m.role === 'Manager' && m.id !== user?.employeeId))
    .reduce((sum, c) => sum + (c.unread_count || 0), 0);

  const primeCostColor =
    profitabilityMetrics?.prime_cost_status === 'good'    ? 'text-emerald-600' :
    profitabilityMetrics?.prime_cost_status === 'warning' ? 'text-amber-500'   : 'text-red-500';

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <PageHeader
        title={isManager ? 'Manager Dashboard' : 'Dashboard'}
        subtitle={currentSite
          ? `${currentSite.name} · ${currentSite.city}, ${currentSite.state}${isManager ? ' — overview & insights' : ''}`
          : isManager ? 'Overview & insights' : `Welcome back, ${user?.employeeName?.split(' ')[0] || user?.username}`}
        color="#5046E4"
        icon="📊"
        actions={
          <div className="flex items-center gap-2">
            {isManager && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted border border-border hover:bg-muted/80 transition-colors text-foreground"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
                Settings
              </button>
            )}
            {isManager && (
              <select
                className={NATIVE_SELECT_CLASS}
                value={selectedId ?? ''}
                onChange={e => setSelectedId(Number(e.target.value))}
              >
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>
                    Week of {s.week_start} ({s.status})
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {/* ── Employee Quick-Access Hub (non-managers only) ── */}
      {!isManager && (
        <div className="space-y-4">
          {/* Quick-access cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Messages */}
            <button
              onClick={() => navigate('/messages')}
              className="group text-left p-4 rounded-2xl bg-card border border-border hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/5 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Messages</span>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: '#8B5CF622', color: '#8B5CF6' }}>
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4.5A1.5 1.5 0 013.5 3h13A1.5 1.5 0 0118 4.5v8A1.5 1.5 0 0116.5 14H11l-3 3v-3H3.5A1.5 1.5 0 012 12.5v-8z"/>
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground leading-none">{totalUnread}</p>
              <p className="text-xs text-muted-foreground mt-1">unread message{totalUnread !== 1 ? 's' : ''}</p>
              {unreadFromManagers > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  {unreadFromManagers} from management
                </div>
              )}
              <p className="mt-3 text-xs font-semibold group-hover:underline" style={{ color: '#8B5CF6' }}>Open Messages →</p>
            </button>

            {/* Shift Swaps */}
            <button
              onClick={() => navigate('/swaps')}
              className="group text-left p-4 rounded-2xl bg-card border border-border hover:border-[#F97316]/40 hover:bg-[#F97316]/5 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shift Swaps</span>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#F9731622', color: '#F97316' }}>
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h12M4 6l3-3M4 6l3 3"/><path d="M16 14H4M16 14l-3-3M16 14l-3 3"/>
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground leading-none">{pendingSwaps.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingSwaps.length === 0 ? 'no pending swaps' : `pending swap request${pendingSwaps.length !== 1 ? 's' : ''}`}
              </p>
              <p className="mt-3 text-xs font-semibold group-hover:underline" style={{ color: '#F97316' }}>View Swaps →</p>
            </button>

            {/* Weekly Survey */}
            <button
              onClick={() => navigate('/surveys')}
              className="group text-left p-4 rounded-2xl bg-card border border-border hover:border-[#EC4899]/40 hover:bg-[#EC4899]/5 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weekly Survey</span>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EC489922', color: '#EC4899' }}>
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 7h6M7 10h6M7 13h4"/>
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground leading-none">{activeSurveys.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeSurveys.length === 0 ? 'no surveys right now' : `active survey${activeSurveys.length !== 1 ? 's' : ''} available`}
              </p>
              {activeSurveys.length > 0 && (
                <p className="mt-3 text-xs font-semibold group-hover:underline" style={{ color: '#EC4899' }}>Take Survey →</p>
              )}
              {activeSurveys.length === 0 && (
                <p className="mt-3 text-xs font-semibold group-hover:underline" style={{ color: '#EC4899' }}>Browse Surveys →</p>
              )}
            </button>
          </div>

          {/* My schedule this week */}
          {myShifts.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">My Schedule This Week</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{myShifts.length} shift{myShifts.length !== 1 ? 's' : ''} scheduled</p>
                </div>
                <button
                  onClick={() => navigate('/schedule')}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Full schedule →
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {myShifts.map(s => {
                  const d = new Date(s.date + 'T00:00:00');
                  const dayName = DAY_NAMES[d.getDay()];
                  const hrs = shiftHours(s.start_time, s.end_time);
                  return (
                    <div key={s.id} className="p-2.5 rounded-xl bg-muted/30 border border-border text-center">
                      <p className="text-[10px] font-semibold text-muted-foreground">{dayName}</p>
                      <p className="text-[10px] text-muted-foreground/70 mb-1">{s.date.slice(5)}</p>
                      <p className="text-xs font-semibold text-foreground">{s.start_time.slice(0, 5)}</p>
                      <p className="text-[10px] text-muted-foreground">–{s.end_time.slice(0, 5)}</p>
                      <p className="text-[10px] font-medium text-primary mt-0.5">{hrs.toFixed(1)}h</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Open shifts link for employees */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/open-shifts')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-[#0EA5E9]/40 hover:bg-[#0EA5E9]/5 transition-all text-sm font-medium text-foreground"
            >
              <svg className="w-4 h-4" style={{ color: '#0EA5E9' }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h12M4 6l3-3M4 6l3 3"/><path d="M16 14H4M16 14l-3-3M16 14l-3 3"/>
              </svg>
              <span>Open Shifts</span>
              <span className="text-xs text-muted-foreground">Pick up extra hours →</span>
            </button>
            <button
              onClick={() => navigate('/schedule')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-[#0D9488]/40 hover:bg-[#0D9488]/5 transition-all text-sm font-medium text-foreground"
            >
              <svg className="w-4 h-4" style={{ color: '#0D9488' }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="14" height="13" rx="2"/><path d="M7 2v4M13 2v4M3 9h14"/>
              </svg>
              <span>My Schedule</span>
              <span className="text-xs text-muted-foreground">View full schedule →</span>
            </button>
          </div>

          {/* Recent Notifications panel */}
          {recentNotifications.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Recent Notifications</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{recentNotifications.length} unread</p>
                </div>
                <button
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => {
                    markAllNotificationsRead().then(() => setRecentNotifications([])).catch(() => {});
                  }}
                >
                  Mark all read
                </button>
              </div>
              <div className="space-y-2">
                {recentNotifications.map(n => {
                  const notifData = (() => { try { return JSON.parse(n.data || '{}'); } catch { return {}; } })();
                  const isPickup = (n.type === 'shift_pickup_needed' || n.type === 'open_shift_available') && notifData.open_shift_id;
                  const isSwapRequest = n.type === 'swap_request_received' || n.type === 'swap_request_created';
                  const isSwapApproved = n.type === 'swap_approved';
                  const isSwapRejected = n.type === 'swap_rejected';
                  const isDropRequest = n.type === 'shift_drop_request';

                  const handleRead = () => {
                    markNotificationRead(n.id).then(() => {
                      setRecentNotifications(prev => prev.filter(x => x.id !== n.id));
                    }).catch(() => {});
                  };

                  return (
                    <div key={n.id} className="flex gap-3 items-start p-3 rounded-xl bg-muted/30 border border-border">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {isPickup && (
                            <button
                              className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors disabled:opacity-60"
                              disabled={claimingShiftId === notifData.open_shift_id}
                              onClick={async () => {
                                setClaimingShiftId(notifData.open_shift_id);
                                try {
                                  await offerForOpenShift(notifData.open_shift_id);
                                  handleRead();
                                  navigate('/open-shifts');
                                } catch (err: any) {
                                  navigate('/open-shifts');
                                } finally {
                                  setClaimingShiftId(null);
                                }
                              }}
                            >
                              {claimingShiftId === notifData.open_shift_id ? 'Claiming…' : '✋ Claim Shift'}
                            </button>
                          )}
                          {(isSwapRequest || isDropRequest) && (
                            <button
                              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors"
                              onClick={() => { handleRead(); navigate('/swaps'); }}
                            >
                              🔄 Review Request
                            </button>
                          )}
                          {isSwapApproved && (
                            <button
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors"
                              onClick={() => { handleRead(); navigate('/schedule'); }}
                            >
                              📅 View Schedule
                            </button>
                          )}
                          {isSwapRejected && (
                            <button
                              className="bg-slate-500 hover:bg-slate-600 text-white text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors"
                              onClick={() => { handleRead(); navigate('/swaps'); }}
                            >
                              👁 View Swaps
                            </button>
                          )}
                          {!isPickup && !isSwapRequest && !isDropRequest && !isSwapApproved && !isSwapRejected && n.link && (
                            <button
                              className="bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors"
                              onClick={() => { handleRead(); navigate(n.link!); }}
                            >
                              View →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Manager: no schedules empty state ── */}
      {isManager && noSchedules && (
        <div className="flex flex-col items-center justify-center py-24 gap-2">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <p className="text-foreground font-semibold">No schedules yet</p>
          <p className="text-sm text-muted-foreground">Go to the Schedule tab to generate your first schedule.</p>
        </div>
      )}

      {/* ── KPI Cards & schedule-dependent content ── */}
      {!noSchedules && (
      <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isManager && (
          <KpiCard
            label="Projected Cost"
            value={laborCost ? `$${laborCost.projected_cost.toLocaleString()}` : '—'}
            sub={laborCost ? `Budget $${laborCost.labor_budget.toLocaleString()}` : ''}
            trend={overBudget ? 'down' : 'up'}
            icon={<DollarIcon />}
          />
        )}
        {isManager && (
          <KpiCard
            label="Budget Usage"
            value={laborCost ? `${budgetPct.toFixed(1)}%` : '—'}
            sub={overBudget
              ? `$${Math.abs(laborCost!.variance).toFixed(0)} over budget`
              : laborCost ? `$${Math.abs(laborCost.variance).toFixed(0)} under budget` : ''}
            trend={budgetPct > 100 ? 'down' : budgetPct > 90 ? 'neutral' : 'up'}
            icon={<ChartIcon />}
          />
        )}
        <KpiCard
          label="High Burnout Risk"
          value={highRisk.length.toString()}
          sub={highRisk.length > 0 ? highRisk.map(b => b.employee_name.split(' ')[0]).join(', ') : 'All clear'}
          trend={highRisk.length > 0 ? 'down' : 'up'}
          icon={<AlertIcon />}
        />
        <KpiCard
          label="Medium Risk"
          value={mediumRisk.length.toString()}
          sub="employees need attention"
          trend={mediumRisk.length > 2 ? 'down' : 'neutral'}
          icon={<UsersIcon />}
        />
      </div>

      {/* ── Profitability Metrics ── */}
      {isManager && profitabilityMetrics && (
        <>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Profitability Metrics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Key metrics for profitable scheduling (target: Prime Cost ≤ 65%)</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {profitabilityMetrics.pos_last_synced ? (
                  (() => {
                    const ps = POS_PLATFORM_STYLES[profitabilityMetrics.pos_last_synced.platform] ?? POS_PLATFORM_STYLES.other;
                    return (
                      <span
                        className="text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
                        style={{ color: ps.color, backgroundColor: ps.bg, borderColor: ps.color + '40' }}
                      >
                        <span>{ps.icon}</span>
                        {profitabilityMetrics.pos_last_synced.display_name}
                      </span>
                    );
                  })()
                ) : posIntegrations.length > 0 ? (
                  (() => {
                    const pi = posIntegrations[0];
                    const ps = POS_PLATFORM_STYLES[pi.platform_name] ?? POS_PLATFORM_STYLES.other;
                    return (
                      <span
                        className="text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
                        style={{ color: ps.color, backgroundColor: ps.bg, borderColor: ps.color + '40' }}
                      >
                        <span>{ps.icon}</span>
                        {pi.display_name}
                      </span>
                    );
                  })()
                ) : null}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  profitabilityMetrics.prime_cost_status === 'good'    ? 'bg-emerald-100 text-emerald-700' :
                  profitabilityMetrics.prime_cost_status === 'warning' ? 'bg-amber-100 text-amber-700'    :
                  'bg-red-100 text-red-700'
                }`}>
                  Prime Cost {profitabilityMetrics.prime_cost_pct.toFixed(1)}%
                  {profitabilityMetrics.prime_cost_status === 'good' ? ' ✓' : profitabilityMetrics.prime_cost_status === 'over' ? ' !' : ''}
                </span>
              </div>
            </div>

            {/* Metrics Grid */}
            {(() => {
              const isHotel = currentSite?.site_type === 'hotel';
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {/* Prime Cost */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prime Cost %</p>
                    <p className={`text-xl font-bold ${primeCostColor}`}>{profitabilityMetrics.prime_cost_pct.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Target ≤ {profitabilityMetrics.prime_cost_target_pct}% · ${profitabilityMetrics.prime_cost.toLocaleString()}
                    </p>
                    <div className="mt-1.5 bg-muted/50 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (profitabilityMetrics.prime_cost_pct / 80) * 100)}%`,
                          backgroundColor:
                            profitabilityMetrics.prime_cost_status === 'good' ? '#10b981' :
                            profitabilityMetrics.prime_cost_status === 'warning' ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>

                  {/* Labor Cost % */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Labor Cost %</p>
                    <p className={`text-xl font-bold ${profitabilityMetrics.labor_cost_pct > profitabilityMetrics.labor_cost_target_pct ? 'text-red-500' : 'text-foreground'}`}>
                      {profitabilityMetrics.labor_cost_pct.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Target ≤ {profitabilityMetrics.labor_cost_target_pct}% · ${profitabilityMetrics.total_labor_cost.toLocaleString()}
                    </p>
                  </div>

                  {/* RevPASH / RevPAR */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {isHotel ? 'Rev / Room-Night' : 'RevPASH'}
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {isHotel
                        ? `$${profitabilityMetrics.total_expected_covers > 0 ? (profitabilityMetrics.total_expected_revenue / profitabilityMetrics.total_expected_covers).toFixed(2) : '0.00'}`
                        : `$${profitabilityMetrics.revpash.toFixed(2)}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {isHotel ? 'Revenue per occupied room' : 'Revenue per seat per hour'}
                    </p>
                  </div>

                  {/* Table Turnover / Occupancy */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {isHotel ? 'Room-Nights / Week' : 'Table Turnover'}
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {isHotel
                        ? profitabilityMetrics.total_expected_covers.toLocaleString()
                        : `${profitabilityMetrics.table_turnover_rate.toFixed(1)}x`}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {isHotel ? 'Occupied room-nights' : 'Covers per service period'}
                    </p>
                  </div>

                  {/* Avg Check per Head / ADR */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {isHotel ? 'Avg Daily Rate (ADR)' : 'Avg Check / Head'}
                    </p>
                    <p className="text-xl font-bold text-foreground">${profitabilityMetrics.avg_check_per_head.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {isHotel
                        ? `${profitabilityMetrics.total_expected_covers.toLocaleString()} room-nights`
                        : `${profitabilityMetrics.total_expected_covers.toLocaleString()} covers`}
                    </p>
                  </div>

                  {/* COGS */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Est. COGS</p>
                    <p className="text-xl font-bold text-foreground">${profitabilityMetrics.estimated_cogs.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{profitabilityMetrics.cogs_pct}% of revenue</p>
                  </div>

                  {/* Revenue */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expected Revenue</p>
                    <p className="text-xl font-bold text-foreground">${profitabilityMetrics.total_expected_revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Projected for the week</p>
                  </div>

                  {/* Employee Turnover Risk */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Turnover Risk</p>
                    <p className={`text-xl font-bold ${profitabilityMetrics.turnover_risk_pct > 30 ? 'text-red-500' : profitabilityMetrics.turnover_risk_pct > 10 ? 'text-amber-500' : 'text-foreground'}`}>
                      {profitabilityMetrics.turnover_risk_pct.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {profitabilityMetrics.high_turnover_risk_count} high-risk employee{profitabilityMetrics.high_turnover_risk_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })()}
          </Card>

          {/* ── Sales by Day ── */}
          {profitabilityMetrics.sales_by_day.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Sales by Day</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={profitabilityMetrics.sales_by_day} barSize={28}>
                    <XAxis dataKey="day_name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip
                      formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']}
                      labelFormatter={(label: string) => `Day: ${label}`}
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Bar dataKey="expected_revenue" radius={[6, 6, 0, 0]}>
                      {profitabilityMetrics.sales_by_day.map((_: DayRevenue, i: number) => (
                        <Cell key={i} fill={['#6366f1','#8b5cf6','#ec4899','#f97316','#06b6d4','#10b981','#f59e0b'][i % 7]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {profitabilityMetrics.sales_by_day.map((day: DayRevenue) => (
                    <div key={day.date} className="text-center">
                      <p className="text-[10px] font-semibold text-muted-foreground">{day.day_name}</p>
                      <p className="text-[10px] font-bold text-foreground">
                        {day.expected_revenue >= 1000
                          ? `$${(day.expected_revenue / 1000).toFixed(1)}k`
                          : `$${day.expected_revenue}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {day.expected_covers}{currentSite?.site_type === 'hotel' ? 'rm' : 'cvr'}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground">Revenue Distribution</h2>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {profitabilityMetrics.site_type === 'hotel' ? 'by shift window' : 'by daypart'}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={profitabilityMetrics.sales_by_daypart}
                      dataKey="revenue_pct"
                      nameKey="daypart"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label={({ daypart, revenue_pct }: any) => `${daypart} ${(revenue_pct * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {profitabilityMetrics.sales_by_daypart.map((_: DaypartRevenue, i: number) => (
                        <Cell key={i} fill={['#6366f1','#8b5cf6','#ec4899','#f97316','#06b6d4','#10b981','#f59e0b'][i % 7]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, _name: string, props: any) =>
                        [`$${props.payload?.revenue?.toLocaleString() ?? 0} (${(v * 100).toFixed(1)}%)`, 'Revenue']
                      }
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {profitabilityMetrics.sales_by_daypart.map((dp: DaypartRevenue) => (
                    <div key={dp.daypart} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted/20 border border-border/50 text-[10px]">
                      <span className="font-semibold text-foreground">{dp.daypart}</span>
                      <span className="text-muted-foreground">{dp.start}–{dp.end}</span>
                      <span className="font-bold text-foreground">
                        {dp.revenue >= 1000 ? `$${(dp.revenue / 1000).toFixed(1)}k` : `$${dp.revenue}`}
                      </span>
                      <span className="text-muted-foreground">
                        {dp.covers} {profitabilityMetrics.site_type === 'hotel' ? 'rm' : 'cvr'}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── Employee Overview ── */}
      {isManager && employees.length > 0 && (
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Employee Overview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Click an employee to view their stats, schedule, labor cost, burnout &amp; turnover risk.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[clamp(200px,40vh,420px)] overflow-y-auto pr-1" tabIndex={0}>
            {employees.map(emp => {
              const burnoutRisk = burnout.find(b => b.employee_id === emp.id);
              const empShifts   = scheduleShifts.filter(s => s.employee_id === emp.id);
              const empCost     = calculateEmployeeLaborCost(empShifts);
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border hover:bg-muted/60 hover:border-primary/30 transition-all cursor-pointer text-center w-full"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center text-sm font-bold ${AVATAR_BG[emp.role] ?? 'bg-muted text-muted-foreground'}`}>
                        {initials(emp.name)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{emp.name}</p>
                    <p className="text-[10px] text-muted-foreground">{emp.role}</p>
                    {empShifts.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">${empCost.toFixed(0)} this week</p>
                    )}
                  </div>
                  {burnoutRisk && burnoutRisk.risk_level !== 'low' && (
                    <Badge variant={riskVariant(burnoutRisk.risk_level)} className="text-[10px] px-1.5 py-0.5">
                      {burnoutRisk.risk_level} risk
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Employee Detail Modal ── */}
      {selectedEmployee && (() => {
        const emp          = selectedEmployee;
        const burnoutRisk  = burnout.find(b => b.employee_id === emp.id);
        const turnoverRisk = getTurnoverRisk(burnoutRisk);
        const empShifts    = scheduleShifts.filter(s => s.employee_id === emp.id).sort((a, b) => a.date.localeCompare(b.date));
        const empCost      = calculateEmployeeLaborCost(empShifts);
        const totalHours   = calculateTotalHours(empShifts);
        const overtimeHours = Math.max(0, totalHours - 40);
        const avgHoursPerShift = empShifts.length > 0 ? totalHours / empShifts.length : 0;
        const costPct      = laborCost && laborCost.projected_cost > 0 ? (empCost / laborCost.projected_cost) * 100 : 0;
        return (
          <Modal
            open={!!selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
            title={emp.name}
            className="sm:max-w-2xl"
          >
            <div className="space-y-5 text-foreground">

              {/* Profile */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
                  {emp.photo_url ? (
                    <img src={emp.photo_url} alt={emp.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-lg font-bold ${AVATAR_BG[emp.role] ?? 'bg-muted text-muted-foreground'}`}>
                      {initials(emp.name)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base">{emp.name}</span>
                    <Badge variant={ROLE_BADGE_VARIANT[emp.role] ?? 'default'}>{emp.role}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                    <span>${emp.hourly_rate.toFixed(2)}/hr</span>
                    <span>Max {emp.weekly_hours_max}h/wk</span>
                    {emp.email && <span>{emp.email}</span>}
                    {emp.phone && <span>{emp.phone}</span>}
                  </div>
                </div>
              </div>

              {/* This Week's Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Shifts</p>
                  <p className="text-xl font-bold text-foreground">{empShifts.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Hours</p>
                  <p className="text-xl font-bold text-foreground">{totalHours.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">of {emp.weekly_hours_max}h max</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Labor Cost</p>
                  <p className="text-xl font-bold text-foreground">${empCost.toFixed(0)}</p>
                  {costPct > 0 && <p className="text-[10px] text-muted-foreground">{costPct.toFixed(1)}% of total</p>}
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Overtime Hrs</p>
                  <p className={`text-xl font-bold ${overtimeHours > 0 ? 'text-red-500' : 'text-foreground'}`}>
                    {overtimeHours.toFixed(1)}
                  </p>
                  {overtimeHours > 0 && <p className="text-[10px] text-red-400">over 40h</p>}
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Avg Hrs/Shift</p>
                  <p className="text-xl font-bold text-foreground">
                    {avgHoursPerShift > 0 ? avgHoursPerShift.toFixed(1) : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Remaining Hrs</p>
                  <p className={`text-xl font-bold ${emp.weekly_hours_max - totalHours < 0 ? 'text-red-500' : 'text-foreground'}`}>
                    {Math.max(0, emp.weekly_hours_max - totalHours).toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">of {emp.weekly_hours_max}h max</p>
                </div>
              </div>

              {/* Schedule */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">This Week's Schedule</h3>
                {empShifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center bg-muted/20 rounded-xl border border-border">No shifts scheduled this week.</p>
                ) : (
                  <div className="space-y-1.5">
                    {empShifts.map(s => {
                      const d = new Date(s.date + 'T00:00:00');
                      const dayName = DAY_NAMES[d.getDay()];
                      const hrs = shiftHours(s.start_time, s.end_time);
                      return (
                        <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm">
                          <span className="w-10 text-xs font-semibold text-muted-foreground shrink-0">{dayName}</span>
                          <span className="text-muted-foreground text-xs shrink-0">{s.date.slice(5)}</span>
                          <span className="font-medium text-foreground">{s.start_time} – {s.end_time}</span>
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">{hrs.toFixed(1)}h</span>
                          <span className="text-xs text-muted-foreground shrink-0">${(hrs * s.hourly_rate).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Burnout Risk */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Burnout Risk</h3>
                {!burnoutRisk ? (
                  <p className="text-sm text-muted-foreground py-3 text-center bg-muted/20 rounded-xl border border-border">No burnout data for this schedule.</p>
                ) : (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Risk Level</span>
                      <Badge variant={riskVariant(burnoutRisk.risk_level)}>{burnoutRisk.risk_level}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Score:</span>
                      <div className="flex-1 bg-muted/50 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${burnoutRisk.risk_score}%`, backgroundColor: RISK_COLORS[burnoutRisk.risk_level] }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{burnoutRisk.risk_score}/100</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Consecutive days: {burnoutRisk.consecutive_days}</span>
                      <span>Clopens: {burnoutRisk.clopens}</span>
                      <span>Doubles: {burnoutRisk.doubles}</span>
                      <span>Late-night shifts: {burnoutRisk.late_night_shifts}</span>
                    </div>
                    {burnoutRisk.factors.length > 0 && (
                      <p className="text-xs text-muted-foreground">{burnoutRisk.factors.join(' · ')}</p>
                    )}
                    {burnoutRisk.rest_days_recommended > 0 && (
                      <p className="text-xs font-medium text-amber-600">
                        {burnoutRisk.rest_days_recommended} rest day{burnoutRisk.rest_days_recommended > 1 ? 's' : ''} recommended
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Turnover Risk */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Turnover Risk</h3>
                <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-start gap-3">
                  <span
                    className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: RISK_COLORS[turnoverRisk.level] }}
                  />
                  <div>
                    <span className="text-sm font-medium capitalize">{turnoverRisk.level} risk</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{turnoverRisk.reason}</p>
                  </div>
                  <Badge variant={riskVariant(turnoverRisk.level)} className="ml-auto shrink-0">{turnoverRisk.level}</Badge>
                </div>
              </div>

              {/* Availability */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Availability</h3>
                {employeeAvailability.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center bg-muted/20 rounded-xl border border-border">No availability set for this employee.</p>
                ) : (
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_NAMES.map((dayName, i) => {
                      const avail = employeeAvailability.find(a => a.day_of_week === i);
                      return (
                        <div
                          key={i}
                          className={`rounded-lg p-2 text-center border ${avail ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-muted/20 border-border'}`}
                        >
                          <p className="text-[10px] font-semibold text-muted-foreground mb-1">{dayName}</p>
                          {avail ? (
                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 leading-tight">
                              {avail.start_time.slice(0, 5)}<br />–<br />{avail.end_time.slice(0, 5)}
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground/60">Off</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </Modal>
        );
      })()}

      {/* ── Staffing Suggestions ── */}
      {isManager && staffingSuggestions.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Demand-Based Staffing</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Recommended staff count per day based on forecast revenue</p>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {staffingSuggestions.map(day => {
              const totalStaff = day.staffing.reduce((sum, s) => sum + s.count, 0);
              const roleGroups: Record<string, number> = {};
              for (const s of day.staffing) roleGroups[s.role] = (roleGroups[s.role] || 0) + s.count;
              return (
                <div key={day.date} className="bg-muted/40 rounded-xl p-3 text-center border border-border">
                  <div className="text-xs font-semibold text-muted-foreground">{DAY_NAMES[day.day_of_week]}</div>
                  <div className="text-xs text-muted-foreground/70 mb-1">{day.date.slice(5)}</div>
                  <div className="text-xl font-bold text-primary">{totalStaff}</div>
                  <div className="text-xs text-muted-foreground">staff</div>
                  {day.expected_revenue > 0 && (
                    <div className="text-xs text-muted-foreground mt-1 font-medium">${(day.expected_revenue / 1000).toFixed(1)}k</div>
                  )}
                  <div className="mt-2 space-y-0.5">
                    {Object.entries(roleGroups).map(([role, count]) => (
                      <div key={role} className="text-[10px] text-muted-foreground">{count} {role}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Labor Cost Chart ── */}
      {isManager && laborCost && laborCost.by_day.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Daily Labor Cost</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={laborCost.by_day} barSize={28}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']}
                labelFormatter={l => `Date: ${l}`}
                contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                {laborCost.by_day.map((_, i) => <Cell key={i} fill="#6366f1" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Cost by Role + Burnout side-by-side ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {isManager && laborCost && laborCost.by_role.length > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Cost by Role</h2>
            <div className="space-y-3">
              {laborCost.by_role.map(r => (
                <div key={r.role} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{r.role}</span>
                  <div className="flex-1 bg-muted/50 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, (r.cost / laborCost.projected_cost) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-14 text-right">${r.cost.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Burnout Risk Monitor</h2>
          {burnout.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/>
              </svg>
              <p className="text-sm">No burnout risks detected</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {burnout.map(b => (
                <div key={b.employee_id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                  <span
                    className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: RISK_COLORS[b.risk_level] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{b.employee_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{b.weekly_hours}h/wk</span>
                    </div>
                    {b.factors.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.factors.join(' · ')}</p>
                    )}
                    {b.rest_days_recommended > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        {b.rest_days_recommended} rest day{b.rest_days_recommended > 1 ? 's' : ''} recommended
                      </p>
                    )}
                  </div>
                  <Badge variant={riskVariant(b.risk_level)} className="shrink-0">{b.risk_level}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* end !noSchedules */}
      </>)}

      {/* ── Restaurant Settings Modal ── */}
      {isManager && (
        <Modal
          open={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          title="Restaurant Settings"
          className="sm:max-w-md"
        >
          <form onSubmit={handleSaveSettings} className="space-y-4 text-foreground">
            <p className="text-xs text-muted-foreground">
              These settings are used to calculate profitability metrics and optimize schedule generation.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Seats</label>
                <input
                  type="number" min={1} required
                  value={settingsForm.seats}
                  onChange={e => setSettingsForm(f => ({ ...f, seats: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Total dining seats</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Tables</label>
                <input
                  type="number" min={1} required
                  value={settingsForm.tables}
                  onChange={e => setSettingsForm(f => ({ ...f, tables: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">For table turnover calc</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">COGS % of Revenue</label>
                <input
                  type="number" min={0} max={100} step={0.1} required
                  value={settingsForm.cogs_pct}
                  onChange={e => setSettingsForm(f => ({ ...f, cogs_pct: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Food &amp; beverage cost % (typ. 28–35%)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Target Labor % of Revenue</label>
                <input
                  type="number" min={0} max={100} step={0.1} required
                  value={settingsForm.target_labor_pct}
                  onChange={e => setSettingsForm(f => ({ ...f, target_labor_pct: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Drives schedule optimization</p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-foreground mb-1">Operating Hours per Day</label>
                <input
                  type="number" min={1} max={24} step={0.5} required
                  value={settingsForm.operating_hours_per_day}
                  onChange={e => setSettingsForm(f => ({ ...f, operating_hours_per_day: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Used for RevPASH calculation</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Prime Cost Target</p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {(settingsForm.cogs_pct + settingsForm.target_labor_pct).toFixed(1)}%
                  <span className="text-[10px] font-normal ml-1">(target ≤ 65%)</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium bg-muted hover:bg-muted/80 text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {settingsSaving ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
