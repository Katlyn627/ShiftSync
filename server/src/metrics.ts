import { getDb } from './db';
import { ProfitabilityMetrics, RestaurantSettings, DaypartRevenue } from './types';
import { getLaborCostSummary } from './laborCost';
import { calculateBurnoutRisks } from './burnout';

// Default restaurant settings used when no settings row exists
const DEFAULT_SETTINGS: RestaurantSettings = {
  seats: 60,
  tables: 15,
  cogs_pct: 30,
  target_labor_pct: 30,
  operating_hours_per_day: 12,
};

// Daypart windows used for revenue distribution
const DAYPARTS = [
  { daypart: 'Breakfast', start: '06:00', end: '11:00', revenue_pct: 0.10 },
  { daypart: 'Lunch',     start: '11:00', end: '15:00', revenue_pct: 0.30 },
  { daypart: 'Dinner',    start: '15:00', end: '21:00', revenue_pct: 0.50 },
  { daypart: 'Late Night',start: '21:00', end: '02:00', revenue_pct: 0.10 },
];

function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftHours(start: string, end: string): number {
  const s = parseMinutes(start);
  let e = parseMinutes(end);
  if (e < s) e += 24 * 60;
  return (e - s) / 60;
}

/** Retrieve persisted restaurant settings, falling back to defaults */
export function getRestaurantSettings(): RestaurantSettings {
  const db = getDb();
  const row = db.prepare('SELECT * FROM restaurant_settings WHERE id = 1').get() as any;
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    seats:                    row.seats,
    tables:                   row.tables,
    cogs_pct:                 row.cogs_pct,
    target_labor_pct:         row.target_labor_pct,
    operating_hours_per_day:  row.operating_hours_per_day,
  };
}

/** Persist restaurant settings (upsert) */
export function saveRestaurantSettings(settings: Partial<RestaurantSettings>): RestaurantSettings {
  const db = getDb();
  const current = getRestaurantSettings();
  const merged: RestaurantSettings = { ...current, ...settings };
  db.prepare(`
    INSERT INTO restaurant_settings (id, seats, tables, cogs_pct, target_labor_pct, operating_hours_per_day)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      seats = excluded.seats,
      tables = excluded.tables,
      cogs_pct = excluded.cogs_pct,
      target_labor_pct = excluded.target_labor_pct,
      operating_hours_per_day = excluded.operating_hours_per_day
  `).run(merged.seats, merged.tables, merged.cogs_pct, merged.target_labor_pct, merged.operating_hours_per_day);
  return merged;
}

/** Compute all profitability metrics for a given schedule */
export function getProfitabilityMetrics(scheduleId: number): ProfitabilityMetrics {
  const db = getDb();
  const settings = getRestaurantSettings();

  const laborSummary = getLaborCostSummary(scheduleId);
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  // Aggregate forecasts for the 7-day week
  const weekDates: string[] = [];
  const start = new Date(schedule.week_start);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  const forecasts = weekDates.map(date =>
    db.prepare('SELECT * FROM forecasts WHERE date = ?').get(date) as any
  ).filter(Boolean);

  const totalExpectedRevenue = forecasts.reduce((s: number, f: any) => s + (f.expected_revenue ?? 0), 0);
  const totalExpectedCovers  = forecasts.reduce((s: number, f: any) => s + (f.expected_covers  ?? 0), 0);

  const totalLaborCost = laborSummary.projected_cost;

  // COGS estimate
  const estimatedCogs = totalExpectedRevenue * (settings.cogs_pct / 100);

  // Prime cost
  const primeCost    = totalLaborCost + estimatedCogs;
  const primeCostPct = totalExpectedRevenue > 0 ? (primeCost / totalExpectedRevenue) * 100 : 0;

  // Labor cost %
  const laborCostPct = totalExpectedRevenue > 0 ? (totalLaborCost / totalExpectedRevenue) * 100 : 0;

  // RevPASH: total revenue ÷ (seats × total operating hours across the week)
  const totalOperatingHours = settings.operating_hours_per_day * 7;
  const revpash = settings.seats > 0 && totalOperatingHours > 0
    ? totalExpectedRevenue / (settings.seats * totalOperatingHours)
    : 0;

  // Table Turnover Rate: total covers ÷ (tables × service periods)
  // Assume 2 service periods per day (lunch + dinner)
  const totalServicePeriods = settings.tables * 7 * 2;
  const tableTurnoverRate = totalServicePeriods > 0 ? totalExpectedCovers / totalServicePeriods : 0;

  // Average check per head
  const avgCheckPerHead = totalExpectedCovers > 0 ? totalExpectedRevenue / totalExpectedCovers : 0;

  // Sales by Daypart — distribute labor cost proportionally across dayparts
  const shifts = db.prepare(`
    SELECT s.start_time, s.end_time, s.role, e.hourly_rate
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ? AND s.status != 'cancelled'
  `).all(scheduleId) as any[];

  const salesByDaypart: DaypartRevenue[] = DAYPARTS.map(dp => {
    const dpStartMin = parseMinutes(dp.start);
    let dpEndMin = parseMinutes(dp.end);
    if (dpEndMin < dpStartMin) dpEndMin += 24 * 60;

    // Labor cost for shifts overlapping this daypart
    let dpLaborCost = 0;
    for (const shift of shifts) {
      const sStart = parseMinutes(shift.start_time);
      let sEnd = parseMinutes(shift.end_time);
      if (sEnd < sStart) sEnd += 24 * 60;

      const overlapStart = Math.max(sStart, dpStartMin);
      const overlapEnd   = Math.min(sEnd,   dpEndMin);
      if (overlapEnd > overlapStart) {
        dpLaborCost += ((overlapEnd - overlapStart) / 60) * shift.hourly_rate;
      }
    }

    return {
      daypart:      dp.daypart,
      start:        dp.start,
      end:          dp.end,
      revenue_pct:  dp.revenue_pct,
      labor_cost:   Math.round(dpLaborCost * 100) / 100,
      covers:       Math.round(totalExpectedCovers * dp.revenue_pct),
    };
  });

  // Employee Turnover Risk from burnout
  const burnoutRisks = calculateBurnoutRisks(scheduleId);
  const highTurnoverCount = burnoutRisks.filter(b => b.risk_level === 'high').length;
  const turnoverRiskPct   = burnoutRisks.length > 0 ? (highTurnoverCount / burnoutRisks.length) * 100 : 0;

  // Prime cost status
  const primeCostStatus: 'good' | 'warning' | 'over' =
    primeCostPct <= 60 ? 'good' :
    primeCostPct <= 65 ? 'warning' :
    'over';

  return {
    schedule_id:              scheduleId,
    week_start:               schedule.week_start,
    prime_cost:               Math.round(primeCost * 100) / 100,
    prime_cost_pct:           Math.round(primeCostPct * 10) / 10,
    prime_cost_target_pct:    65,
    prime_cost_status:        primeCostStatus,
    total_labor_cost:         Math.round(totalLaborCost * 100) / 100,
    labor_cost_pct:           Math.round(laborCostPct * 10) / 10,
    labor_cost_target_pct:    settings.target_labor_pct,
    total_expected_revenue:   Math.round(totalExpectedRevenue * 100) / 100,
    total_expected_covers:    totalExpectedCovers,
    estimated_cogs:           Math.round(estimatedCogs * 100) / 100,
    cogs_pct:                 settings.cogs_pct,
    revpash:                  Math.round(revpash * 100) / 100,
    table_turnover_rate:      Math.round(tableTurnoverRate * 10) / 10,
    avg_check_per_head:       Math.round(avgCheckPerHead * 100) / 100,
    sales_by_daypart:         salesByDaypart,
    high_turnover_risk_count: highTurnoverCount,
    turnover_risk_pct:        Math.round(turnoverRiskPct * 10) / 10,
  };
}
