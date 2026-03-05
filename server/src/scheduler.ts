import { getDb } from './db';
import { Employee, Availability, Forecast, DailyStaffingSuggestion } from './types';
import { getRestaurantSettings } from './metrics';
import { calculateBurnoutRisks } from './burnout';

// ── Burnout protection thresholds ────────────────────────────────────────────
// Employees exceeding these scores from the previous week have their effective
// weekly hours cap reduced to encourage recovery.
const BURNOUT_HIGH_THRESHOLD = 70;    // risk_score >= this → cap at 85 % of weekly_hours_max
const BURNOUT_MED_THRESHOLD  = 50;    // risk_score >= this → cap at 92 % of weekly_hours_max
const BURNOUT_HIGH_HOURS_FACTOR = 0.85;
const BURNOUT_MED_HOURS_FACTOR  = 0.92;

// ── Standby (on-call) revenue thresholds ─────────────────────────────────────
// Minimum revenue required before designating on-call backups for the day.
// Thresholds are chosen to match the same staffing tiers used in computeDayNeeds.
const STANDBY_VERY_HIGH_REVENUE = 7000; // >= $7 k → 3 standbys
const STANDBY_HIGH_REVENUE      = 5000; // >= $5 k → 2 standbys
// Days at or above the week's average daily revenue get 1 standby (computed inline)

interface GenerateOptions {
  weekStart: string; // YYYY-MM-DD (Monday)
  laborBudget: number;
}

interface DayNeed {
  date: string;
  dayOfWeek: number;
  shiftsNeeded: { role: string; start: string; end: string; count: number }[];
}

// Determine staffing needs based on forecast and target labor cost %
function computeDayNeeds(
  forecast: Forecast | undefined,
  date: string,
  dayOfWeek: number,
  targetLaborPct: number,
): DayNeed {
  const revenue = forecast?.expected_revenue ?? 3000;

  // Base staffing tiers by revenue
  let serverCount = 2;
  let hostCount = 1;
  let kitchenCount = 2;
  let barCount = 1;

  if (revenue >= 8000) {
    serverCount = 5; kitchenCount = 4; barCount = 2; hostCount = 2;
  } else if (revenue >= 5000) {
    serverCount = 4; kitchenCount = 3; barCount = 2; hostCount = 1;
  } else if (revenue >= 3000) {
    serverCount = 3; kitchenCount = 2; barCount = 1; hostCount = 1;
  }

  // Weekend bump
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    serverCount = Math.ceil(serverCount * 1.3);
    kitchenCount = Math.ceil(kitchenCount * 1.2);
  }

  // Scale back staffing if target labor % is aggressive (< 28%), scale up if generous (> 35%)
  if (targetLaborPct < 28) {
    serverCount  = Math.max(1, serverCount  - 1);
    kitchenCount = Math.max(1, kitchenCount - 1);
  } else if (targetLaborPct > 35) {
    serverCount  = serverCount  + 1;
    kitchenCount = kitchenCount + 1;
  }

  return {
    date,
    dayOfWeek,
    shiftsNeeded: [
      { role: 'Server',  start: '11:00', end: '19:00', count: Math.ceil(serverCount  / 2) },
      { role: 'Server',  start: '15:00', end: '23:00', count: Math.floor(serverCount  / 2) },
      { role: 'Kitchen', start: '10:00', end: '18:00', count: Math.ceil(kitchenCount / 2) },
      { role: 'Kitchen', start: '14:00', end: '22:00', count: Math.floor(kitchenCount / 2) },
      { role: 'Bar',     start: '16:00', end: '00:00', count: barCount },
      { role: 'Host',    start: '11:00', end: '19:00', count: hostCount },
      { role: 'Manager', start: '09:00', end: '17:00', count: 1 },
    ],
  };
}

function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isAvailable(avail: Availability | undefined, shiftStart: string, shiftEnd: string): boolean {
  if (!avail) return false;
  const aStart = parseMinutes(avail.start_time);
  const aEnd = parseMinutes(avail.end_time);
  const sStart = parseMinutes(shiftStart);
  let sEnd = parseMinutes(shiftEnd);
  if (sEnd < sStart) sEnd += 24 * 60; // overnight
  const availEndAdj = aEnd < aStart ? aEnd + 24 * 60 : aEnd;
  return aStart <= sStart && availEndAdj >= sEnd;
}

export function generateSchedule(options: GenerateOptions): number {
  const db = getDb();
  const { weekStart, laborBudget } = options;

  // Load restaurant settings to drive prime-cost-aware scheduling
  const settings = getRestaurantSettings();

  // ── 1. Cross-week burnout lookback ────────────────────────────────────────
  // Load the most recent prior schedule to inform burnout-aware scheduling
  const prevSchedule = db.prepare(
    `SELECT id FROM schedules WHERE week_start < ? ORDER BY week_start DESC LIMIT 1`
  ).get(weekStart) as { id: number } | undefined;

  // Map employee_id → burnout risk score from previous schedule
  const prevBurnoutScores: Record<number, number> = {};
  // Map employee_id → trailing consecutive days worked from previous week
  const prevConsecCarryover: Record<number, { consec: number; lastDate: string }> = {};

  if (prevSchedule) {
    try {
      const prevRisks = calculateBurnoutRisks(prevSchedule.id);
      for (const risk of prevRisks) {
        prevBurnoutScores[risk.employee_id] = risk.risk_score;
      }
    } catch (_) {
      // If the previous schedule's burnout calculation fails (e.g. empty schedule),
      // proceed without burnout lookback — employees will be scheduled normally.
    }

    // Build the date of the last day of the previous week
    const prevWeekEndObj = new Date(weekStart);
    prevWeekEndObj.setDate(prevWeekEndObj.getDate() - 1);
    const prevWeekEnd = prevWeekEndObj.toISOString().split('T')[0];

    // Group previous schedule's shifts by employee, sorted date-descending
    const prevShifts = db.prepare(`
      SELECT employee_id, date
      FROM shifts
      WHERE schedule_id = ? AND status != 'cancelled'
      ORDER BY employee_id, date DESC
    `).all(prevSchedule.id) as Array<{ employee_id: number; date: string }>;

    const byEmployee: Record<number, string[]> = {};
    for (const s of prevShifts) {
      byEmployee[s.employee_id] = byEmployee[s.employee_id] || [];
      byEmployee[s.employee_id].push(s.date);
    }

    // Count trailing consecutive days ending at prevWeekEnd
    for (const [empIdStr, dates] of Object.entries(byEmployee)) {
      const empId = parseInt(empIdStr);
      const sortedDesc = [...dates].sort().reverse(); // most recent first
      let consec = 0;
      const checkObj = new Date(prevWeekEnd);

      for (const d of sortedDesc) {
        if (d === checkObj.toISOString().split('T')[0]) {
          consec++;
          checkObj.setDate(checkObj.getDate() - 1);
        } else {
          break;
        }
      }

      if (consec > 0) {
        prevConsecCarryover[empId] = { consec, lastDate: prevWeekEnd };
      }
    }
  }

  // ── 2. Create schedule record ─────────────────────────────────────────────
  const scheduleResult = db.prepare(
    'INSERT INTO schedules (week_start, labor_budget, status) VALUES (?, ?, ?)'
  ).run(weekStart, laborBudget, 'draft');
  const scheduleId = scheduleResult.lastInsertRowid as number;

  const employees = db.prepare('SELECT * FROM employees').all() as Employee[];
  const allAvailability = db.prepare('SELECT * FROM availability').all() as Availability[];

  // Track employee state across this week
  const employeeWeeklyHours: Record<number, number> = {};
  const employeeLastShiftEnd: Record<number, { date: string; endTime: string }> = {};
  // Days each employee works this week (for consecutive-day tracking)
  const employeeWorkDays: Record<number, Set<string>> = {};

  employees.forEach(e => {
    employeeWeeklyHours[e.id] = 0;
    employeeWorkDays[e.id] = new Set();
  });

  const weekDates: string[] = [];
  const startDate = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  // ── 3. Per-day revenue-proportional budget allocation ─────────────────────
  const weekForecasts = weekDates.map(date =>
    db.prepare('SELECT * FROM forecasts WHERE date = ?').get(date) as Forecast | undefined
  );
  const dayRevenues = weekDates.map((_, i) => weekForecasts[i]?.expected_revenue ?? 3000);
  const totalWeekRevenue = dayRevenues.reduce((s, r) => s + r, 0);

  // Allow 10% flex over the tighter of budget vs. target-labor-pct-of-revenue
  const LABOR_BUFFER_MULTIPLIER = 1.1;
  const laborPctCeiling = totalWeekRevenue * (settings.target_labor_pct / 100);
  const effectiveLaborCeiling = Math.min(laborBudget, laborPctCeiling) * LABOR_BUFFER_MULTIPLIER;

  // Per-day budget proportional to each day's revenue share (with 15% flex per day)
  const DAY_BUDGET_FLEX = 1.15;
  const perDayBudget: Record<string, number> = {};
  const perDayCost: Record<string, number> = {};
  for (let i = 0; i < weekDates.length; i++) {
    const share = totalWeekRevenue > 0 ? dayRevenues[i] / totalWeekRevenue : 1 / 7;
    perDayBudget[weekDates[i]] = effectiveLaborCeiling * share * DAY_BUDGET_FLEX;
    perDayCost[weekDates[i]] = 0;
  }

  let totalCost = 0;

  const insertShift = db.prepare(
    'INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertStandby = db.prepare(
    'INSERT OR IGNORE INTO standby_assignments (schedule_id, employee_id, date, role) VALUES (?, ?, ?, ?)'
  );

  // ── Helper: count consecutive days worked immediately before targetDate ───
  // Counts days worked in this week that form an unbroken chain ending at
  // targetDate - 1, then adds carryover consecutive days from the previous week.
  function getConsecDaysBeforeDate(empId: number, targetDate: string): number {
    let consec = 0;
    const d = new Date(targetDate);
    d.setDate(d.getDate() - 1); // start from the day before targetDate

    while (true) {
      const ds = d.toISOString().split('T')[0];

      if (ds < weekStart) {
        // Gone past the start of this week — add carryover from previous schedule
        const carryover = prevConsecCarryover[empId];
        if (carryover && carryover.lastDate === ds) {
          consec += carryover.consec;
        }
        break;
      }

      if (employeeWorkDays[empId].has(ds)) {
        consec++;
        d.setDate(d.getDate() - 1);
      } else {
        break; // chain broken
      }
    }

    return consec;
  }

  for (const date of weekDates) {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    const forecast = db.prepare('SELECT * FROM forecasts WHERE date = ?').get(date) as Forecast | undefined;
    const dayNeeds = computeDayNeeds(forecast, date, dayOfWeek, settings.target_labor_pct);

    // Track employees assigned a regular shift today (for standby selection)
    const scheduledTodayIds = new Set<number>();

    // ── 4. Burnout-aware priority sort ────────────────────────────────────
    // Sort by composite score: hours-utilisation fraction + burnout penalty.
    // This gives fair distribution while deprioritising high-burnout employees.
    const sorted = [...employees].sort((a, b) => {
      const aFrac = (employeeWeeklyHours[a.id] ?? 0) / (a.weekly_hours_max || 40);
      const bFrac = (employeeWeeklyHours[b.id] ?? 0) / (b.weekly_hours_max || 40);
      const aBurnout = (prevBurnoutScores[a.id] ?? 0) / 100;
      const bBurnout = (prevBurnoutScores[b.id] ?? 0) / 100;
      // Burnout weight: 0.5 means a risk_score of 100 equates to 50% extra penalty
      return (aFrac + aBurnout * 0.5) - (bFrac + bBurnout * 0.5);
    });

    for (const need of dayNeeds.shiftsNeeded) {
      let assigned = 0;
      const shiftHrs = (() => {
        const s = parseMinutes(need.start);
        let e = parseMinutes(need.end);
        if (e < s) e += 24 * 60;
        return (e - s) / 60;
      })();

      for (const emp of sorted) {
        if (assigned >= need.count) break;
        if (emp.role !== need.role && emp.role !== 'Manager') continue;
        if (emp.role === 'Manager' && need.role !== 'Manager') continue;

        const avail = allAvailability.find(
          a => a.employee_id === emp.id && a.day_of_week === dayOfWeek
        );
        if (!isAvailable(avail, need.start, need.end)) continue;

        // ── 5. Burnout-adjusted weekly hours cap ──────────────────────────
        // Reduce effective max hours for employees carrying high burnout risk
        // from the previous schedule to allow recovery.
        const currentHours = employeeWeeklyHours[emp.id] ?? 0;
        const burnoutScore = prevBurnoutScores[emp.id] ?? 0;
        const effectiveMaxHours =
          burnoutScore >= BURNOUT_HIGH_THRESHOLD ? Math.floor(emp.weekly_hours_max * BURNOUT_HIGH_HOURS_FACTOR) :
          burnoutScore >= BURNOUT_MED_THRESHOLD  ? Math.floor(emp.weekly_hours_max * BURNOUT_MED_HOURS_FACTOR)  :
          emp.weekly_hours_max;

        if (currentHours + shiftHrs > effectiveMaxHours) continue;

        const shiftCost = emp.hourly_rate * shiftHrs;

        // Global labor cost ceiling (prime-cost-aware)
        if (totalCost + shiftCost > effectiveLaborCeiling) continue;

        // Per-day revenue-proportional budget ceiling
        if ((perDayCost[date] ?? 0) + shiftCost > perDayBudget[date]) continue;

        // Avoid clopens: check if last shift ended less than 9 hours before this one
        const last = employeeLastShiftEnd[emp.id];
        if (last && last.date !== date) {
          const lastDateObj = new Date(last.date);
          const currDateObj = new Date(date);
          const dayDiff = (currDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24);
          if (dayDiff === 1) {
            const lastEndMin = parseMinutes(last.endTime);
            const thisStartMin = parseMinutes(need.start) + 24 * 60;
            const turnaround = (thisStartMin - lastEndMin) / 60;
            if (turnaround < 9) continue; // skip to avoid clopen
          }
        }

        // ── 6. Consecutive days prevention ────────────────────────────────
        // Prevent scheduling more than 6 consecutive working days to reduce
        // burnout risk, including carryover from the previous schedule week.
        const consecBefore = getConsecDaysBeforeDate(emp.id, date);
        if (consecBefore >= 6) continue; // would be the 7th consecutive day

        insertShift.run(scheduleId, emp.id, date, need.start, need.end, need.role, 'scheduled');
        employeeWeeklyHours[emp.id] = currentHours + shiftHrs;
        employeeLastShiftEnd[emp.id] = { date, endTime: need.end };
        employeeWorkDays[emp.id].add(date);
        perDayCost[date] = (perDayCost[date] ?? 0) + shiftCost;
        totalCost += shiftCost;
        scheduledTodayIds.add(emp.id);
        assigned++;
      }
    }

    // ── 7. Standby / callout-coverage pool ───────────────────────────────
    // Reserve on-call workers for each day to cover last-minute callouts.
    // Number of standbys scales with forecast revenue so high-revenue shifts
    // always have adequate backup coverage.
    const dayRevenue = forecast?.expected_revenue ?? 3000;
    const avgDailyRevenue = totalWeekRevenue / 7;

    let standbysNeeded = 0;
    if (dayRevenue >= STANDBY_VERY_HIGH_REVENUE) standbysNeeded = 3;       // very high revenue
    else if (dayRevenue >= STANDBY_HIGH_REVENUE) standbysNeeded = 2;        // high revenue
    else if (dayRevenue >= avgDailyRevenue)       standbysNeeded = 1;        // average+

    if (standbysNeeded > 0) {
      // Prefer Servers and Kitchen for standby since they are most commonly needed
      const standbyRolePriority = ['Server', 'Kitchen', 'Bar', 'Host', 'Manager'];
      let standbyAssigned = 0;

      for (const rolePref of standbyRolePriority) {
        if (standbyAssigned >= standbysNeeded) break;

        for (const emp of sorted) {
          if (standbyAssigned >= standbysNeeded) break;
          if (scheduledTodayIds.has(emp.id)) continue;
          if (emp.role !== rolePref) continue;

          const avail = allAvailability.find(
            a => a.employee_id === emp.id && a.day_of_week === dayOfWeek
          );
          if (!avail) continue;

          // Don't designate someone who is already at their weekly hours limit
          if ((employeeWeeklyHours[emp.id] ?? 0) >= emp.weekly_hours_max) continue;

          insertStandby.run(scheduleId, emp.id, date, emp.role);
          standbyAssigned++;
        }
      }
    }
  }

  return scheduleId;
}

// Returns demand-based staffing suggestions for a week without creating a schedule
export function computeWeeklyStaffingNeeds(weekStart: string): DailyStaffingSuggestion[] {
  const db = getDb();
  const settings = getRestaurantSettings();
  const suggestions: DailyStaffingSuggestion[] = [];

  const startDate = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const date = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    const forecast = db.prepare('SELECT * FROM forecasts WHERE date = ?').get(date) as Forecast | undefined;
    const dayNeed = computeDayNeeds(forecast, date, dayOfWeek, settings.target_labor_pct);

    suggestions.push({
      date,
      day_of_week: dayOfWeek,
      expected_revenue: forecast?.expected_revenue ?? 3000,
      expected_covers: forecast?.expected_covers ?? 0,
      staffing: dayNeed.shiftsNeeded,
    });
  }

  return suggestions;
}
