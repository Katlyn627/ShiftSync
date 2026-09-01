import { getDb } from './db';
import { FairnessReport, FairnessEmployee, RoleFairnessStats, InstabilityReport } from './types';

function parseMinutes(time: string): number {
  const [h, m] = (time || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function shiftHours(start: string, end: string): number {
  const startMin = parseMinutes(start);
  let endMin = parseMinutes(end);
  if (endMin < startMin) endMin += 24 * 60; // overnight
  return (endMin - startMin) / 60;
}

function isNightShift(startTime: string, endTime: string): boolean {
  const endMin = parseMinutes(endTime);
  const startMin = parseMinutes(startTime);
  return endMin < startMin || endMin >= 22 * 60 || startMin >= 22 * 60;
}

function isWeekend(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

export function calculateFairnessReport(params: {
  schedule_id?: number;
  site_id?: number;
  week_start?: string;
  week_end?: string;
}): FairnessReport {
  const db = getDb();
  const { schedule_id, site_id, week_start } = params;

  let scheduleIds: number[] = [];
  if (schedule_id) {
    scheduleIds = [schedule_id];
  } else if (site_id) {
    const rows = week_start
      ? db.prepare('SELECT id FROM schedules WHERE site_id = ? AND week_start = ?').all(site_id, week_start) as { id: number }[]
      : db.prepare('SELECT id FROM schedules WHERE site_id = ? ORDER BY week_start DESC LIMIT 1').all(site_id) as { id: number }[];
    scheduleIds = rows.map(r => r.id);
  } else if (week_start) {
    const rows = db.prepare('SELECT id FROM schedules WHERE week_start = ?').all(week_start) as { id: number }[];
    scheduleIds = rows.map(r => r.id);
  } else {
    const latest = db.prepare('SELECT id FROM schedules ORDER BY week_start DESC LIMIT 1').get() as { id: number } | undefined;
    if (latest) scheduleIds = [latest.id];
  }

  if (scheduleIds.length === 0) {
    return { employees: [], role_stats: [], summary: null };
  }

  const placeholders = scheduleIds.map(() => '?').join(',');
  const shifts = db.prepare(`
    SELECT s.*, e.name as employee_name, e.role as employee_role, e.department as employee_department, e.weekly_hours_max
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id IN (${placeholders}) AND s.status != 'cancelled'
    ORDER BY s.employee_id, s.date, s.start_time
  `).all(scheduleIds) as Array<{
    id: number;
    schedule_id: number;
    employee_id: number;
    date: string;
    start_time: string;
    end_time: string;
    role: string;
    employee_name: string;
    employee_role: string;
    employee_department: string;
    weekly_hours_max: number;
  }>;

  // Group shifts by employee
  const byEmployee = new Map<number, typeof shifts>();
  shifts.forEach(s => {
    const list = byEmployee.get(s.employee_id) || [];
    list.push(s);
    byEmployee.set(s.employee_id, list);
  });

  const fairnessEmployees: FairnessEmployee[] = [];
  const hoursByRole = new Map<string, number[]>();
  const nightShiftsByRole = new Map<string, number[]>();
  const weekendShiftsByRole = new Map<string, number[]>();

  byEmployee.forEach((empShifts, empId) => {
    const first = empShifts[0];
    const totalShifts = empShifts.length;
    let totalHours = 0;
    let nightShifts = 0;
    let weekendShifts = 0;

    for (const sh of empShifts) {
      const h = shiftHours(sh.start_time, sh.end_time);
      totalHours += h;
      if (isNightShift(sh.start_time, sh.end_time)) nightShifts++;
      if (isWeekend(sh.date)) weekendShifts++;
    }

    const roundedHours = Math.round(totalHours * 10) / 10;
    const weeklyMax = first.weekly_hours_max || 40;
    const overtimeHours = roundedHours > weeklyMax ? Math.round((roundedHours - weeklyMax) * 10) / 10 : 0;

    const role = first.employee_role || first.role || 'Staff';
    if (!hoursByRole.has(role)) hoursByRole.set(role, []);
    hoursByRole.get(role)!.push(roundedHours);

    if (!nightShiftsByRole.has(role)) nightShiftsByRole.set(role, []);
    nightShiftsByRole.get(role)!.push(nightShifts);

    if (!weekendShiftsByRole.has(role)) weekendShiftsByRole.set(role, []);
    weekendShiftsByRole.get(role)!.push(weekendShifts);

    fairnessEmployees.push({
      employee_id: empId,
      employee_name: first.employee_name,
      role,
      department: first.employee_department || undefined,
      total_shifts: totalShifts,
      total_hours: roundedHours,
      night_shifts: nightShifts,
      weekend_shifts: weekendShifts,
      overtime_hours: overtimeHours,
      fairness_flags: [],
    });
  });

  // Calculate role stats and role-based fairness benchmarks
  const roleStats: RoleFairnessStats[] = [];
  hoursByRole.forEach((hoursList, role) => {
    const count = hoursList.length;
    const avgHours = Math.round((hoursList.reduce((a, b) => a + b, 0) / count) * 10) / 10;
    const nightList = nightShiftsByRole.get(role) || [];
    const avgNight = Math.round((nightList.reduce((a, b) => a + b, 0) / count) * 10) / 10;
    const weekendList = weekendShiftsByRole.get(role) || [];
    const avgWeekend = Math.round((weekendList.reduce((a, b) => a + b, 0) / count) * 10) / 10;
    const stdDev = calculateStdDev(hoursList);

    const score: 'equitable' | 'moderate' | 'inequitable' =
      stdDev <= 3.5 ? 'equitable' : stdDev <= 6.0 ? 'moderate' : 'inequitable';

    roleStats.push({
      role,
      employee_count: count,
      avg_hours: avgHours,
      avg_night_shifts: avgNight,
      avg_weekend_shifts: avgWeekend,
      hours_std_dev: stdDev,
      fairness_score: score,
    });
  });

  // Assign individual fairness flags
  const roleStatMap = new Map(roleStats.map(r => [r.role, r]));
  let flaggedCount = 0;

  fairnessEmployees.forEach(emp => {
    const rStat = roleStatMap.get(emp.role);
    const flags: string[] = [];

    if (emp.overtime_hours > 0) {
      flags.push('overtime');
    }
    if (rStat && (emp.total_hours > rStat.avg_hours + 8 || emp.total_hours >= 44)) {
      flags.push('high_hours');
    }
    if (rStat && emp.night_shifts >= 3 && emp.night_shifts > rStat.avg_night_shifts + 1.5) {
      flags.push('concentrated_nights');
    }
    if (rStat && emp.weekend_shifts >= 2 && emp.weekend_shifts > rStat.avg_weekend_shifts + 1) {
      flags.push('concentrated_weekends');
    }

    emp.fairness_flags = flags;
    if (flags.length > 0) flaggedCount++;
  });

  return {
    employees: fairnessEmployees.sort((a, b) => b.fairness_flags.length - a.fairness_flags.length || b.total_hours - a.total_hours),
    role_stats: roleStats.sort((a, b) => b.employee_count - a.employee_count),
    summary: {
      total_employees: fairnessEmployees.length,
      total_shifts: shifts.length,
      employees_with_flags: flaggedCount,
    },
  };
}

export function calculateInstabilityReport(scheduleId: number): InstabilityReport {
  const db = getDb();
  const sched = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!sched) {
    throw new Error('Schedule not found');
  }

  const shifts = db.prepare('SELECT * FROM shifts WHERE schedule_id = ?').all(scheduleId) as any[];
  const totalShifts = shifts.length;
  const cancelledShifts = shifts.filter(s => s.status === 'cancelled').length;
  const activeShifts = totalShifts - cancelledShifts;
  const cancellationRatePct = totalShifts > 0 ? Math.round((cancelledShifts / totalShifts) * 1000) / 10 : 0;

  // Calculate quick returns (< 11 hours rest)
  const byEmployee = new Map<number, any[]>();
  shifts.filter(s => s.status !== 'cancelled').forEach(s => {
    const list = byEmployee.get(s.employee_id) || [];
    list.push(s);
    byEmployee.set(s.employee_id, list);
  });

  let quickReturns = 0;
  byEmployee.forEach(empShifts => {
    const sorted = [...empShifts].sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevEndMin = parseMinutes(prev.end_time);
      const currStartMin = parseMinutes(curr.start_time);
      const [y1, m1, d1] = prev.date.split('-').map(Number);
      const [y2, m2, d2] = curr.date.split('-').map(Number);
      const prevDate = new Date(Date.UTC(y1, m1 - 1, d1, Math.floor(prevEndMin / 60), prevEndMin % 60));
      const currDate = new Date(Date.UTC(y2, m2 - 1, d2, Math.floor(currStartMin / 60), currStartMin % 60));
      const diffHours = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 0 && diffHours < 11) {
        quickReturns++;
      }
    }
  });

  // Callouts & Change requests
  const calloutCountRow = db.prepare(`
    SELECT COUNT(*) as c FROM callouts
    WHERE shift_id IN (SELECT id FROM shifts WHERE schedule_id = ?)
  `).get(scheduleId) as { c: number } | undefined;
  const calloutCount = calloutCountRow?.c || 0;

  const changeRequestRow = db.prepare(`
    SELECT COUNT(*) as c FROM change_requests
    WHERE shift_id IN (SELECT id FROM shifts WHERE schedule_id = ?)
  `).get(scheduleId) as { c: number } | undefined;
  const changeRequests = changeRequestRow?.c || 0;

  const lateChangeRow = db.prepare(`
    SELECT COUNT(*) as c FROM change_requests cr
    JOIN shifts s ON cr.shift_id = s.id
    WHERE s.schedule_id = ? AND julianday(s.date) - julianday(cr.created_at) < 7
  `).get(scheduleId) as { c: number } | undefined;
  const lateChangeCount = lateChangeRow?.c || 0;

  // Publish advance days
  const requiredAdvanceDays = 14;
  const schedCreated = new Date(sched.created_at || new Date().toISOString());
  const [sy, sm, sd] = sched.week_start.split('-').map(Number);
  const weekStartDate = new Date(Date.UTC(sy, sm - 1, sd));
  const diffDays = Math.max(0, Math.round((weekStartDate.getTime() - schedCreated.getTime()) / (1000 * 60 * 60 * 24)));
  const daysAdvancePublished = diffDays;

  const predictabilityPayExposureCount = lateChangeCount + (cancelledShifts > 0 ? 1 : 0) + (daysAdvancePublished < requiredAdvanceDays ? 1 : 0);

  // Instability score calculation (0–100)
  const score = Math.min(
    100,
    Math.round(
      cancellationRatePct * 1.5 +
      quickReturns * 6 +
      calloutCount * 5 +
      lateChangeCount * 4 +
      (daysAdvancePublished < requiredAdvanceDays ? 12 : 0)
    )
  );

  const instabilityLevel: 'stable' | 'moderate' | 'volatile' =
    score < 15 ? 'stable' : score < 35 ? 'moderate' : 'volatile';

  return {
    schedule_id: scheduleId,
    week_start: sched.week_start,
    site_id: sched.site_id ?? null,
    status: sched.status,
    total_shifts: totalShifts,
    active_shifts: activeShifts,
    cancelled_shifts: cancelledShifts,
    cancellation_rate_pct: cancellationRatePct,
    change_requests: changeRequests,
    late_change_count: lateChangeCount,
    quick_returns: quickReturns,
    callout_count: calloutCount,
    days_advance_published: daysAdvancePublished,
    required_advance_days: requiredAdvanceDays,
    predictability_pay_exposure_count: predictabilityPayExposureCount,
    instability_score: score,
    instability_level: instabilityLevel,
  };
}

