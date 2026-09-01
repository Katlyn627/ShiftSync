import { getDb } from './db';
import { LaborCostSummary, DepartmentLaborCost } from './types';
import { calculateBurnoutRisks } from './burnout';

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

  // Calculate burnout risks for all employees scheduled in this period
  const burnoutRisks = calculateBurnoutRisks(scheduleId);
  const burnoutScoreMap = new Map<number, number>();
  burnoutRisks.forEach((b) => burnoutScoreMap.set(b.employee_id, b.risk_score));
  const highBurnoutCount = burnoutRisks.filter((b) => b.risk_level === 'high').length;
  const mediumBurnoutCount = burnoutRisks.filter((b) => b.risk_level === 'medium').length;

  let projectedCost = 0;
  let programDirectCost = 0;
  let adminIndirectCost = 0;
  let totalLaborHours = 0;
  let volunteerHours = 0;

  const byDayMap: Record<string, { cost: number; program_cost: number; admin_cost: number; volunteer_hours: number }> = {};
  const byRoleMap: Record<string, { cost: number; hours: number }> = {};
  const byDeptMap: Record<string, { cost: number; hours: number; employees: Set<number>; burnoutScores: number[]; isDirect: boolean }> = {};

  const ADMIN_DEPARTMENTS = new Set([
    'Executive Leadership',
    'Finance, HR & Administrative Ops',
    'Management',
  ]);

  for (const shift of shifts) {
    const hours = shiftHours(shift.start_time, shift.end_time);
    totalLaborHours += hours;

    const dayEntry = byDayMap[shift.date] || { cost: 0, program_cost: 0, admin_cost: 0, volunteer_hours: 0 };
    const roleEntry = byRoleMap[shift.role] || { cost: 0, hours: 0 };
    const dept = shift.department || 'General Operations';
    const isDirect = !ADMIN_DEPARTMENTS.has(dept);
    const deptEntry = byDeptMap[dept] || { cost: 0, hours: 0, employees: new Set<number>(), burnoutScores: [], isDirect };

    deptEntry.hours += hours;
    if (shift.employee_id) {
      deptEntry.employees.add(shift.employee_id);
      const bScore = burnoutScoreMap.get(shift.employee_id);
      if (bScore !== undefined) deptEntry.burnoutScores.push(bScore);
    }
    roleEntry.hours += hours;

    if (shift.is_volunteer || shift.role === 'Volunteer' || shift.hourly_rate === 0) {
      volunteerHours += hours;
      dayEntry.volunteer_hours += hours;
    } else {
      const cost = hours * shift.hourly_rate;
      projectedCost += cost;
      dayEntry.cost += cost;
      roleEntry.cost += cost;
      deptEntry.cost += cost;

      if (isDirect) {
        programDirectCost += cost;
        dayEntry.program_cost += cost;
      } else {
        adminIndirectCost += cost;
        dayEntry.admin_cost += cost;
      }
    }

    byDayMap[shift.date] = dayEntry;
    byRoleMap[shift.role] = roleEntry;
    byDeptMap[dept] = deptEntry;
  }

  // Independent Sector national volunteer hourly value benchmark ($33.49/hr)
  const VOLUNTEER_VALUE_PER_HOUR = 33.49;
  const volunteerInKindValue = Math.round(volunteerHours * VOLUNTEER_VALUE_PER_HOUR * 100) / 100;
  const fringeRate = 0.24; // 24% standard fringe benefits (FICA, healthcare, workers comp)
  const fringeBenefitsCost = Math.round(projectedCost * fringeRate * 100) / 100;
  const totalPayrollObligation = Math.round((projectedCost + fringeBenefitsCost) * 100) / 100;
  const totalProgramValue = Math.round((totalPayrollObligation + volunteerInKindValue) * 100) / 100;
  const remainingGrantBalance = Math.round((schedule.labor_budget - projectedCost) * 100) / 100;

  const totalDirectPlusIndirect = programDirectCost + adminIndirectCost;
  const programExpenseRatio = totalDirectPlusIndirect > 0
    ? Math.round((programDirectCost / totalDirectPlusIndirect) * 1000) / 10
    : 80.0;

  const by_department: DepartmentLaborCost[] = Object.entries(byDeptMap).map(([deptName, d]) => {
    const avgBurnout = d.burnoutScores.length > 0
      ? Math.round((d.burnoutScores.reduce((a, b) => a + b, 0) / d.burnoutScores.length) * 10) / 10
      : 0;
    return {
      department: deptName,
      cost: Math.round(d.cost * 100) / 100,
      hours: Math.round(d.hours * 10) / 10,
      employee_count: d.employees.size,
      avg_burnout_score: avgBurnout,
      is_direct: d.isDirect,
    };
  }).sort((a, b) => b.cost - a.cost);

  const by_day = Object.entries(byDayMap).sort().map(([date, d]) => ({
    date,
    cost: Math.round(d.cost * 100) / 100,
    program_cost: Math.round(d.program_cost * 100) / 100,
    admin_cost: Math.round(d.admin_cost * 100) / 100,
    volunteer_hours: Math.round(d.volunteer_hours * 10) / 10,
  }));

  const by_role = Object.entries(byRoleMap).sort().map(([role, r]) => ({
    role,
    cost: Math.round(r.cost * 100) / 100,
    hours: Math.round(r.hours * 10) / 10,
  }));

  return {
    schedule_id: scheduleId,
    week_start: schedule.week_start,
    labor_budget: schedule.labor_budget,
    projected_cost: Math.round(projectedCost * 100) / 100,
    actual_cost: Math.round(projectedCost * 100) / 100,
    variance: Math.round((projectedCost - schedule.labor_budget) * 100) / 100,
    by_day,
    by_role,
    by_department,
    program_direct_cost: Math.round(programDirectCost * 100) / 100,
    admin_indirect_cost: Math.round(adminIndirectCost * 100) / 100,
    program_expense_ratio: programExpenseRatio,
    fringe_benefits_cost: fringeBenefitsCost,
    total_payroll_obligation: totalPayrollObligation,
    volunteer_in_kind_hours: Math.round(volunteerHours * 10) / 10,
    volunteer_in_kind_value: volunteerInKindValue,
    total_program_value: totalProgramValue,
    remaining_grant_balance: remainingGrantBalance,
    total_labor_hours: Math.round(totalLaborHours * 10) / 10,
    high_burnout_count: highBurnoutCount,
    medium_burnout_count: mediumBurnoutCount,
  };
}