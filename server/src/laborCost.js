import Schedule from './models/Schedule.js';
import Shift from './models/Shift.js';

function parseMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftHoursCalc(start, end) {
  const startMin = parseMinutes(start);
  let endMin = parseMinutes(end);
  if (endMin < startMin) endMin += 24 * 60;
  return (endMin - startMin) / 60;
}

export async function getLaborCostSummary(scheduleId) {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  const shifts = await Shift.find({
    schedule_id: scheduleId,
    status: { $ne: 'cancelled' },
  }).populate('employee_id', 'hourly_rate name');

  let projectedCost = 0;
  const byDay = {};
  const byRole = {};

  for (const shift of shifts) {
    const hours = shiftHoursCalc(shift.start_time, shift.end_time);
    const rate = shift.employee_id?.hourly_rate ?? 0;
    const cost = hours * rate;
    projectedCost += cost;
    byDay[shift.date] = (byDay[shift.date] || 0) + cost;
    byRole[shift.role] = (byRole[shift.role] || 0) + cost;
  }

  return {
    schedule_id: schedule._id.toString(),
    week_start: schedule.week_start,
    labor_budget: schedule.labor_budget,
    projected_cost: Math.round(projectedCost * 100) / 100,
    actual_cost: Math.round(projectedCost * 100) / 100,
    variance: Math.round((projectedCost - schedule.labor_budget) * 100) / 100,
    by_day: Object.entries(byDay).sort().map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 })),
    by_role: Object.entries(byRole).sort().map(([role, cost]) => ({ role, cost: Math.round(cost * 100) / 100 })),
  };
}
