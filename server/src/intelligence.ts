import { getDb } from './db';
import { getLaborCostSummary } from './laborCost';
import { calculateBurnoutRisks } from './burnout';
import { getRestaurantSettings } from './metrics';

// ── Thresholds ────────────────────────────────────────────────────────────────
// How far below/above optimal before we flag a day as understaffed/overstaffed.
const UNDERSTAFF_THRESHOLD   = 0.80;  // actual/optimal < 80 % → understaffed
const OVERSTAFF_THRESHOLD    = 1.25;  // actual/optimal > 125 % → overstaffed
const BUDGET_TIGHT_PCT       = 90;    // utilisation > 90 % → tight
const BUDGET_FLEXIBLE_PCT    = 65;    // utilisation < 65 % → flexible

// Typical covers a single server can handle in one full day (two service shifts)
// Adjusted downward for high-check environments (more attentive / longer tables)
const BASE_COVERS_PER_SERVER_DAY = 35;

// ── Public types ──────────────────────────────────────────────────────────────

export interface DayIntelligence {
  date: string;
  day_of_week: number;
  expected_revenue: number;
  expected_covers: number;
  /** Weekly avg check per head (same value for all days – context only) */
  avg_check_per_head: number;
  /** Weekly table turnover rate (same value for all days – context only) */
  table_turnover_rate: number;
  /** Optimal server count the algorithm targets */
  optimal_server_count: number;
  actual_server_count: number;
  /** Optimal kitchen count the algorithm targets */
  optimal_kitchen_count: number;
  actual_kitchen_count: number;
  total_scheduled: number;
  /** 0–100: how likely the day is short-staffed relative to demand */
  understaffed_probability: number;
  /** 0–100: how likely the day has excess staff relative to demand */
  overstaffed_probability: number;
  staffing_status: 'adequate' | 'understaffed' | 'overstaffed';
  /** Employees with high burnout risk scheduled on this day */
  burnout_alert_count: number;
  /** Employees' names with high burnout risk on this day */
  burnout_alert_names: string[];
  day_labor_cost: number;
  /** This day's share of weekly revenue (0–100 %) */
  day_revenue_share: number;
  budget_allocated: number;
  budget_utilization_pct: number;
  budget_status: 'tight' | 'on_track' | 'flexible';
}

export interface ScheduleIntelligence {
  schedule_id: number;
  week_start: string;
  labor_budget: number;
  total_labor_cost: number;
  avg_check_per_head: number;
  table_turnover_rate: number;
  days: DayIntelligence[];
  overall_burnout_alert_count: number;
  /** (budget - cost) / budget × 100 */
  budget_flexibility_pct: number;
  budget_status: 'tight' | 'on_track' | 'flexible';
  /** Days flagged as understaffed */
  understaffed_days: number;
  /** Days flagged as overstaffed */
  overstaffed_days: number;
}

// ── Helper: derive optimal server count from covers + weekly metrics ──────────
/**
 * Mirrors the same logic used inside `computeDayNeeds` in scheduler.ts so that
 * the "optimal" we report is consistent with what the generator aimed for.
 */
function deriveOptimalServerCount(
  covers: number,
  revenue: number,
  dayOfWeek: number,
  avgCheckPerHead: number,
  tableTurnoverRate: number,
  targetLaborPct: number,
): number {
  // Service intensity: high avg-check venues require more attentive staff
  const serviceIntensityFactor =
    avgCheckPerHead > 60 ? 0.65 :
    avgCheckPerHead > 45 ? 0.80 :
    avgCheckPerHead > 30 ? 0.95 : 1.0;

  // Turnover intensity: more table turns per shift → higher server workload
  const turnoverFactor = tableTurnoverRate > 3 ? 1.25 : tableTurnoverRate > 2 ? 1.12 : 1.0;

  const coversPerServer = BASE_COVERS_PER_SERVER_DAY * serviceIntensityFactor;
  let serverCount = Math.ceil((covers / coversPerServer) * turnoverFactor);

  // Weekend bump
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    serverCount = Math.ceil(serverCount * 1.3);
  }

  // Revenue-tier floor to keep minimum viable staffing
  const revFloor =
    revenue >= 8000 ? 5 :
    revenue >= 5000 ? 4 :
    revenue >= 3000 ? 3 : 2;
  serverCount = Math.max(serverCount, revFloor);

  // Scale back or up based on target labor cost %
  if (targetLaborPct < 28) serverCount = Math.max(1, serverCount - 1);
  else if (targetLaborPct > 35) serverCount = serverCount + 1;

  return Math.min(serverCount, 8); // hard cap
}

// ── Main export ───────────────────────────────────────────────────────────────

export function getScheduleIntelligence(scheduleId: number): ScheduleIntelligence {
  const db       = getDb();
  const settings = getRestaurantSettings();

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  const laborSummary  = getLaborCostSummary(scheduleId);
  const burnoutRisks  = calculateBurnoutRisks(scheduleId);

  // Build a quick lookup: employee_id → burnout info
  const highBurnoutMap: Record<number, string> = {};
  for (const r of burnoutRisks) {
    if (r.risk_level === 'high') highBurnoutMap[r.employee_id] = r.employee_name;
  }

  // Shifts for the whole schedule (with employee role)
  const allShifts = db.prepare(`
    SELECT s.*, e.role as employee_role, e.hourly_rate, e.name as employee_name
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ? AND s.status != 'cancelled'
  `).all(scheduleId) as any[];

  // Week dates
  const weekDates: string[] = [];
  const start = new Date(schedule.week_start);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  // Load forecasts once
  const forecastByDate: Record<string, { expected_revenue: number; expected_covers: number }> = {};
  for (const date of weekDates) {
    const f = db.prepare('SELECT expected_revenue, expected_covers FROM forecasts WHERE date = ?').get(date) as any;
    if (f) forecastByDate[date] = f;
  }

  // ── Weekly-level derived metrics ──────────────────────────────────────────
  const totalRevenue = weekDates.reduce((s, d) => s + (forecastByDate[d]?.expected_revenue ?? 3000), 0);
  const totalCovers  = weekDates.reduce((s, d) => s + (forecastByDate[d]?.expected_covers  ?? 0),    0);

  // Fall back to the same default the seed uses (revenue / 32) so that
  // downstream calculations in deriveOptimalServerCount are never zero-based.
  const avgCheckPerHead  = totalCovers > 0 ? totalRevenue / totalCovers : 32;
  const totalServicePeriods = settings.tables * 7 * 2; // 2 service periods/day (lunch + dinner)
  const tableTurnoverRate   = totalServicePeriods > 0 ? totalCovers / totalServicePeriods : 1.5;

  // Per-day budget: proportional to each day's revenue share
  const perDayBudget: Record<string, number> = {};
  for (const date of weekDates) {
    const rev   = forecastByDate[date]?.expected_revenue ?? 3000;
    const share = totalRevenue > 0 ? rev / totalRevenue : 1 / 7;
    perDayBudget[date] = schedule.labor_budget * share;
  }

  // Per-day actual labor cost (from labor summary by_day)
  const perDayCost: Record<string, number> = {};
  for (const entry of laborSummary.by_day) {
    perDayCost[entry.date] = entry.cost;
  }

  // ── Per-day analysis ──────────────────────────────────────────────────────
  const days: DayIntelligence[] = weekDates.map(date => {
    const dateObj  = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const revenue  = forecastByDate[date]?.expected_revenue ?? 3000;
    const covers   = forecastByDate[date]?.expected_covers  ?? Math.floor(revenue / 32);

    // Optimal staffing for this day using the same derivation as the scheduler
    const optimalServers  = deriveOptimalServerCount(
      covers, revenue, dayOfWeek, avgCheckPerHead, tableTurnoverRate, settings.target_labor_pct
    );
    const optimalKitchen  = Math.max(1, Math.ceil(optimalServers * 0.7));
    const optimalTotal    = optimalServers + optimalKitchen + 1 /* manager */ + 1 /* bar */;

    // Actual scheduled counts for this day
    const dayShifts          = allShifts.filter((s: any) => s.date === date);
    const actualServers      = dayShifts.filter((s: any) => s.employee_role === 'Server').length;
    const actualKitchen      = dayShifts.filter((s: any) => s.employee_role === 'Kitchen').length;
    const totalScheduled     = dayShifts.length;

    // Staffing probability based on how far we are from optimal total
    const staffingRatio = optimalTotal > 0 ? totalScheduled / optimalTotal : 1;
    let understaffedProb = 0;
    let overstaffedProb  = 0;

    if (staffingRatio < UNDERSTAFF_THRESHOLD) {
      // Linear scale: at 0 coverage → 100 %, at threshold → 0 %
      understaffedProb = Math.min(100, Math.round((1 - staffingRatio / UNDERSTAFF_THRESHOLD) * 100));
    } else if (staffingRatio > OVERSTAFF_THRESHOLD) {
      // Linear scale: at threshold → 0 %, at 2× optimal → 100 %
      overstaffedProb = Math.min(100, Math.round(
        ((staffingRatio - OVERSTAFF_THRESHOLD) / (2 - OVERSTAFF_THRESHOLD)) * 100
      ));
    }

    // Server-specific under/over also bumps the probability
    const serverRatio = optimalServers > 0 ? actualServers / optimalServers : 1;
    if (serverRatio < UNDERSTAFF_THRESHOLD) {
      understaffedProb = Math.min(100, Math.max(understaffedProb,
        Math.round((1 - serverRatio / UNDERSTAFF_THRESHOLD) * 80)
      ));
    }

    // Staffing status
    const staffingStatus: 'adequate' | 'understaffed' | 'overstaffed' =
      understaffedProb >= 30 ? 'understaffed' :
      overstaffedProb  >= 30 ? 'overstaffed'  : 'adequate';

    // Burnout alerts for employees working this day
    const burnoutAlertNames = dayShifts
      .filter((s: any) => highBurnoutMap[s.employee_id] !== undefined)
      .map((s: any) => highBurnoutMap[s.employee_id] as string)
      .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

    // Budget analysis
    const dayBudget     = perDayBudget[date] ?? (schedule.labor_budget / 7);
    const dayCost       = perDayCost[date]   ?? 0;
    const budgetUtilPct = dayBudget > 0 ? (dayCost / dayBudget) * 100 : 0;
    const budgetStatus: 'tight' | 'on_track' | 'flexible' =
      budgetUtilPct > BUDGET_TIGHT_PCT    ? 'tight'    :
      budgetUtilPct < BUDGET_FLEXIBLE_PCT ? 'flexible' : 'on_track';

    return {
      date,
      day_of_week:               dayOfWeek,
      expected_revenue:          revenue,
      expected_covers:           covers,
      avg_check_per_head:        Math.round(avgCheckPerHead * 100) / 100,
      table_turnover_rate:       Math.round(tableTurnoverRate * 10) / 10,
      optimal_server_count:      optimalServers,
      actual_server_count:       actualServers,
      optimal_kitchen_count:     optimalKitchen,
      actual_kitchen_count:      actualKitchen,
      total_scheduled:           totalScheduled,
      understaffed_probability:  understaffedProb,
      overstaffed_probability:   overstaffedProb,
      staffing_status:           staffingStatus,
      burnout_alert_count:       burnoutAlertNames.length,
      burnout_alert_names:       burnoutAlertNames,
      day_labor_cost:            Math.round(dayCost * 100) / 100,
      day_revenue_share:         totalRevenue > 0
                                   ? Math.round((revenue / totalRevenue) * 1000) / 10
                                   : 0,
      budget_allocated:          Math.round(dayBudget * 100) / 100,
      budget_utilization_pct:    Math.round(budgetUtilPct * 10) / 10,
      budget_status:             budgetStatus,
    };
  });

  // ── Schedule-level summary ────────────────────────────────────────────────
  const overallBurnoutCount = Object.keys(highBurnoutMap).length;
  const totalCost           = laborSummary.projected_cost;
  const flexPct             = schedule.labor_budget > 0
    ? ((schedule.labor_budget - totalCost) / schedule.labor_budget) * 100 : 0;

  const overallBudgetStatus: 'tight' | 'on_track' | 'flexible' =
    flexPct < 5  ? 'tight'    :
    flexPct > 20 ? 'flexible' : 'on_track';

  return {
    schedule_id:                 scheduleId,
    week_start:                  schedule.week_start,
    labor_budget:                schedule.labor_budget,
    total_labor_cost:            Math.round(totalCost * 100) / 100,
    avg_check_per_head:          Math.round(avgCheckPerHead * 100) / 100,
    table_turnover_rate:         Math.round(tableTurnoverRate * 10) / 10,
    days,
    overall_burnout_alert_count: overallBurnoutCount,
    budget_flexibility_pct:      Math.round(flexPct * 10) / 10,
    budget_status:               overallBudgetStatus,
    understaffed_days:           days.filter(d => d.staffing_status === 'understaffed').length,
    overstaffed_days:            days.filter(d => d.staffing_status === 'overstaffed').length,
  };
}
