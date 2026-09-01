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
    SELECT s.*, e.hourly_rate, e.name as employee_name, e.department, e.is_volunteer
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ? AND s.status != 'cancelled'
  `).all(scheduleId) as any[];

  let projectedCost = 0;
  let programDirectCost = 0;
  let adminIndirectCost = 0;
  let totalLaborHours = 0;
  let volunteerHours = 0;
  const byDay: Record<string, number> = {};
  const byRole: Record<string, number> = {};

  const ADMIN_DEPARTMENTS = new Set([
    'Executive Leadership',
    'Finance, HR & Administrative Ops',
    'Management',
  ]);

  for (const shift of shifts) {
    const hours = shiftHours(shift.start_time, shift.end_time);
    totalLaborHours += hours;

    if (shift.is_volunteer || shift.role === 'Volunteer' || shift.hourly_rate === 0) {
      volunteerHours += hours;
    } else {
      const cost = hours * shift.hourly_rate;
      projectedCost += cost;
      byDay[shift.date] = (byDay[shift.date] || 0) + cost;
      byRole[shift.role] = (byRole[shift.role] || 0) + cost;

      if (ADMIN_DEPARTMENTS.has(shift.department)) {
        adminIndirectCost += cost;
      } else {
        programDirectCost += cost;
      }
    }
  }

  // Independent Sector national volunteer hourly value benchmark ($33.49/hr)
  const VOLUNTEER_VALUE_PER_HOUR = 33.49;
  const volunteerInKindValue = Math.round(volunteerHours * VOLUNTEER_VALUE_PER_HOUR * 100) / 100;
  const fringeRate = 0.24; // 24% standard fringe benefits
  const fringeBenefitsCost = Math.round(projectedCost * fringeRate * 100) / 100;

  const totalDirectPlusIndirect = programDirectCost + adminIndirectCost;
  const programExpenseRatio = totalDirectPlusIndirect > 0
    ? Math.round((programDirectCost / totalDirectPlusIndirect) * 1000) / 10
    : 80.0;

  return {
    schedule_id: scheduleId,
    week_start: schedule.week_start,
    labor_budget: schedule.labor_budget,
    projected_cost: Math.round(projectedCost * 100) / 100,
    actual_cost: Math.round(projectedCost * 100) / 100,
    variance: Math.round((projectedCost - schedule.labor_budget) * 100) / 100,
    by_day: Object.entries(byDay).sort().map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 })),
    by_role: Object.entries(byRole).sort().map(([role, cost]) => ({ role, cost: Math.round(cost * 100) / 100 })),
    program_direct_cost: Math.round(programDirectCost * 100) / 100,
    admin_indirect_cost: Math.round(adminIndirectCost * 100) / 100,
    program_expense_ratio: programExpenseRatio,
    fringe_benefits_cost: fringeBenefitsCost,
    volunteer_in_kind_hours: Math.round(volunteerHours * 10) / 10,
    volunteer_in_kind_value: volunteerInKindValue,
    total_labor_hours: Math.round(totalLaborHours * 10) / 10,
  };
}