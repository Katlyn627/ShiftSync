import { getDb } from './db';
import { LaborCostSummary } from './types';

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

export function getLaborCostSummary(scheduleId: number): LaborCostSummary {
  const db = getDb();

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  const shifts = db.prepare(`
    SELECT s.*, e.hourly_rate, e.name as employee_name
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ? AND s.status != 'cancelled'
  `).all(scheduleId) as any[];

  let projectedCost = 0;
  const byDay: Record<string, number> = {};
  const byRole: Record<string, number> = {};

  for (const shift of shifts) {
    const hours = shiftHours(shift.start_time, shift.end_time);
    const cost = hours * shift.hourly_rate;
    projectedCost += cost;
    byDay[shift.date] = (byDay[shift.date] || 0) + cost;
    byRole[shift.role] = (byRole[shift.role] || 0) + cost;
  }

  return {
    schedule_id: scheduleId,
    week_start: schedule.week_start,
    labor_budget: schedule.labor_budget,
    projected_cost: Math.round(projectedCost * 100) / 100,
    actual_cost: Math.round(projectedCost * 100) / 100, // same as projected for now
    variance: Math.round((projectedCost - schedule.labor_budget) * 100) / 100,
    by_day: Object.entries(byDay).sort().map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 })),
    by_role: Object.entries(byRole).sort().map(([role, cost]) => ({ role, cost: Math.round(cost * 100) / 100 })),
  };
}
