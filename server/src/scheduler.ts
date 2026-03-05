import { getDb } from './db';
import { Employee, Availability, Forecast, DailyStaffingSuggestion } from './types';
import { getRestaurantSettings } from './metrics';

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

  // Create schedule record
  const scheduleResult = db.prepare(
    'INSERT INTO schedules (week_start, labor_budget, status) VALUES (?, ?, ?)'
  ).run(weekStart, laborBudget, 'draft');
  const scheduleId = scheduleResult.lastInsertRowid as number;

  const employees = db.prepare('SELECT * FROM employees').all() as Employee[];
  const allAvailability = db.prepare('SELECT * FROM availability').all() as Availability[];
  
  // Track employee hours this week
  const employeeWeeklyHours: Record<number, number> = {};
  const employeeLastShiftEnd: Record<number, { date: string; endTime: string }> = {};
  
  employees.forEach(e => { employeeWeeklyHours[e.id] = 0; });

  const weekDates: string[] = [];
  const startDate = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  // Calculate total projected week revenue for labor % guardrail
  const weekForecasts = weekDates.map(date =>
    db.prepare('SELECT * FROM forecasts WHERE date = ?').get(date) as Forecast | undefined
  );
  const totalWeekRevenue = weekForecasts.reduce((s, f) => s + (f?.expected_revenue ?? 3000), 0);
  // Hard labor cost ceiling: min(laborBudget × 1.1, targetLaborPct% of revenue)
  const laborPctCeiling = totalWeekRevenue * (settings.target_labor_pct / 100);
  const effectiveLaborCeiling = Math.min(laborBudget * 1.1, laborPctCeiling * 1.1);

  let totalCost = 0;

  const insertShift = db.prepare(
    'INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  for (const date of weekDates) {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    const forecast = db.prepare('SELECT * FROM forecasts WHERE date = ?').get(date) as Forecast | undefined;
    const dayNeeds = computeDayNeeds(forecast, date, dayOfWeek, settings.target_labor_pct);

    // Sort employees by fewest assigned hours this week first (fairness algorithm)
    const sorted = [...employees].sort(
      (a, b) => (employeeWeeklyHours[a.id] ?? 0) - (employeeWeeklyHours[b.id] ?? 0)
    );

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

        const currentHours = employeeWeeklyHours[emp.id] ?? 0;
        if (currentHours + shiftHrs > emp.weekly_hours_max) continue;

        const shiftCost = emp.hourly_rate * shiftHrs;
        // Enforce effective labor cost ceiling (prime-cost-aware)
        if (totalCost + shiftCost > effectiveLaborCeiling) continue;

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

        insertShift.run(scheduleId, emp.id, date, need.start, need.end, need.role, 'scheduled');
        employeeWeeklyHours[emp.id] = currentHours + shiftHrs;
        employeeLastShiftEnd[emp.id] = { date, endTime: need.end };
        totalCost += shiftCost;
        assigned++;
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
