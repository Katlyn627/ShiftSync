/**
 * /api/fairness — Workforce Fairness Analytics
 *
 * Measures equitable distribution of schedule burden across employees:
 * - Night/late-night shifts
 * - Weekend shifts
 * - Overtime and extra hours
 * - Short-notice schedule changes
 * - Shift volatility per employee
 *
 * Supports the "Why was this shift offered to me?" and fairness dashboard
 * requirements from the product spec.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireManager } from '../middleware/auth';

const router = Router();

function toMinutes(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function shiftHours(start: string, end: string): number {
  let s = toMinutes(start); let e = toMinutes(end);
  if (e <= s) e += 24 * 60; return (e - s) / 60;
}
function isLateNight(start: string, end: string): boolean {
  const s = toMinutes(start); const e = toMinutes(end);
  return e < s || e >= 22 * 60 || s >= 22 * 60;
}
function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00').getDay();
  return d === 0 || d === 6;
}

/**
 * GET /api/fairness?site_id=&week_start=
 * Returns per-employee distribution metrics for the given schedule or date range.
 */
router.get('/', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const { site_id, schedule_id, week_start, week_end } = req.query as Record<string, string | undefined>;

  const siteId = site_id ? parseInt(site_id, 10) : (req.user?.siteId ?? null);

  let shifts: any[];
  if (schedule_id) {
    shifts = db.prepare(`
      SELECT s.*, e.name as emp_name, e.role, e.site_id
      FROM shifts s JOIN employees e ON s.employee_id = e.id
      WHERE s.schedule_id = ? AND s.status != 'cancelled'
    `).all(schedule_id) as any[];
  } else if (week_start) {
    const end = week_end ?? new Date(new Date(week_start + 'T00:00:00').getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const conds = ['s.date >= ? AND s.date < ?', "s.status != 'cancelled'"];
    const params: (string | number)[] = [week_start, end];
    if (siteId !== null) { conds.push('e.site_id = ?'); params.push(siteId); }
    shifts = db.prepare(`
      SELECT s.*, e.name as emp_name, e.role, e.site_id
      FROM shifts s JOIN employees e ON s.employee_id = e.id
      WHERE ${conds.join(' AND ')}
    `).all(...params) as any[];
  } else {
    return res.status(400).json({ error: 'schedule_id or week_start is required' });
  }

  // Aggregate per employee
  const empMap: Record<number, any> = {};
  for (const s of shifts) {
    if (!empMap[s.employee_id]) {
      empMap[s.employee_id] = {
        employee_id: s.employee_id,
        employee_name: s.emp_name,
        role: s.role,
        total_shifts: 0,
        total_hours: 0,
        night_shifts: 0,
        weekend_shifts: 0,
        overtime_hours: 0,
      };
    }
    const emp = empMap[s.employee_id];
    const h = shiftHours(s.start_time, s.end_time);
    emp.total_shifts++;
    emp.total_hours += h;
    if (isLateNight(s.start_time, s.end_time)) emp.night_shifts++;
    if (isWeekend(s.date)) emp.weekend_shifts++;
    if (emp.total_hours > 40) emp.overtime_hours = emp.total_hours - 40;
  }

  const employees = Object.values(empMap);
  if (employees.length === 0) return res.json({ employees: [], summary: null });

  // Compute distribution stats per role
  const roleGroups: Record<string, any[]> = {};
  for (const e of employees) {
    if (!roleGroups[e.role]) roleGroups[e.role] = [];
    roleGroups[e.role].push(e);
  }

  const roleStats = Object.entries(roleGroups).map(([role, emps]) => {
    const avgHours = emps.reduce((s, e) => s + e.total_hours, 0) / emps.length;
    const avgNights = emps.reduce((s, e) => s + e.night_shifts, 0) / emps.length;
    const avgWeekends = emps.reduce((s, e) => s + e.weekend_shifts, 0) / emps.length;
    const hoursStdDev = Math.sqrt(emps.reduce((s, e) => s + Math.pow(e.total_hours - avgHours, 2), 0) / emps.length);
    return {
      role,
      employee_count: emps.length,
      avg_hours: Math.round(avgHours * 10) / 10,
      avg_night_shifts: Math.round(avgNights * 10) / 10,
      avg_weekend_shifts: Math.round(avgWeekends * 10) / 10,
      hours_std_dev: Math.round(hoursStdDev * 10) / 10,
      fairness_score: hoursStdDev < 2 ? 'equitable' : hoursStdDev < 5 ? 'moderate' : 'inequitable',
    };
  });

  // Flag outliers (employees significantly above/below avg in their role)
  const employeesWithFlags = employees.map(e => {
    const roleGroup = roleGroups[e.role] ?? [];
    const avgH = roleGroup.reduce((s: number, r: any) => s + r.total_hours, 0) / (roleGroup.length || 1);
    const avgN = roleGroup.reduce((s: number, r: any) => s + r.night_shifts, 0) / (roleGroup.length || 1);
    const avgW = roleGroup.reduce((s: number, r: any) => s + r.weekend_shifts, 0) / (roleGroup.length || 1);
    const flags: string[] = [];
    if (e.total_hours > avgH * 1.3 && e.total_hours - avgH > 4) flags.push('high_hours');
    if (e.night_shifts > avgN * 1.5 && e.night_shifts - avgN > 1) flags.push('concentrated_nights');
    if (e.weekend_shifts > avgW * 1.5 && e.weekend_shifts - avgW > 1) flags.push('concentrated_weekends');
    if (e.overtime_hours > 0) flags.push('overtime');
    return { ...e, fairness_flags: flags, total_hours: Math.round(e.total_hours * 10) / 10, overtime_hours: Math.round(e.overtime_hours * 10) / 10 };
  });

  res.json({
    employees: employeesWithFlags.sort((a, b) => b.total_hours - a.total_hours),
    role_stats: roleStats,
    summary: {
      total_employees: employees.length,
      total_shifts: shifts.length,
      employees_with_flags: employeesWithFlags.filter(e => e.fairness_flags.length > 0).length,
    },
  });
});

/**
 * GET /api/fairness/instability?schedule_id=&site_id=
 * Schedule instability analytics: volatility, canceled shifts, timing changes,
 * quick returns, concentrated overtime, predictability-pay exposure.
 */
router.get('/instability', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const { schedule_id, site_id, week_start } = req.query as Record<string, string | undefined>;
  const siteId = site_id ? parseInt(site_id, 10) : (req.user?.siteId ?? null);

  let schedules: any[];
  if (schedule_id) {
    schedules = [db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule_id)].filter(Boolean) as any[];
  } else if (week_start) {
    const cond = siteId !== null ? 'AND site_id = ?' : '';
    schedules = siteId !== null
      ? db.prepare(`SELECT * FROM schedules WHERE week_start = ? ${cond}`).all(week_start, siteId) as any[]
      : db.prepare(`SELECT * FROM schedules WHERE week_start = ?`).all(week_start) as any[];
  } else {
    // Return last 4 weeks
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    schedules = siteId !== null
      ? db.prepare('SELECT * FROM schedules WHERE week_start >= ? AND site_id = ? ORDER BY week_start DESC').all(fourWeeksAgo, siteId) as any[]
      : db.prepare('SELECT * FROM schedules WHERE week_start >= ? ORDER BY week_start DESC').all(fourWeeksAgo) as any[];
  }

  const results = schedules.map(schedule => {
    const allShifts = db.prepare("SELECT * FROM shifts WHERE schedule_id = ?").all(schedule.id) as any[];
    const cancelledShifts = allShifts.filter(s => s.status === 'cancelled');
    const activeShifts = allShifts.filter(s => s.status !== 'cancelled');

    // Change requests for this schedule's shifts
    const shiftIds = allShifts.map(s => s.id);
    const changeRequests = shiftIds.length > 0
      ? db.prepare(`SELECT * FROM schedule_change_requests WHERE shift_id IN (${shiftIds.map(() => '?').join(',')})`)
          .all(...shiftIds) as any[]
      : [];

    const lateChanges = changeRequests.filter(cr => {
      if (!cr.original_date) return false;
      const daysBefore = (new Date(cr.original_date).getTime() - new Date(cr.created_at).getTime()) / (24 * 3600 * 1000);
      return daysBefore < 14; // within predictability window
    });

    // Callout events for this week
    const callouts = db.prepare(`
      SELECT ce.* FROM callout_events ce
      JOIN shifts s ON ce.shift_id = s.id
      WHERE s.schedule_id = ?
    `).all(schedule.id) as any[];

    // Quick returns (clopens < rest threshold)
    let quickReturns = 0;
    const compRule = db.prepare("SELECT rule_value FROM compliance_rules WHERE jurisdiction = 'default' AND rule_type = 'min_rest_hours'").get() as any;
    const minRest = compRule ? parseFloat(compRule.rule_value) : 10;

    const byEmployee: Record<number, any[]> = {};
    for (const s of activeShifts) {
      if (!byEmployee[s.employee_id]) byEmployee[s.employee_id] = [];
      byEmployee[s.employee_id].push(s);
    }
    for (const empShifts of Object.values(byEmployee)) {
      const sorted = [...empShifts].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (prev.date === curr.date) continue; // same day, skip
        const prevEndMin = toMinutes(prev.end_time);
        const currStartMin = toMinutes(curr.start_time);
        // Cross-day rest calculation
        const prevDateMs = new Date(prev.date + 'T00:00:00').getTime();
        const currDateMs = new Date(curr.date + 'T00:00:00').getTime();
        const dayDiff = (currDateMs - prevDateMs) / (24 * 3600 * 1000);
        if (dayDiff === 1) {
          const gapMinutes = (24 * 60 - prevEndMin) + currStartMin;
          if (gapMinutes < minRest * 60) quickReturns++;
        }
      }
    }

    // Advance notice check: any schedules published less than 14 days before week_start?
    const publishedAt = schedule.created_at;
    const weekStartDate = new Date(schedule.week_start + 'T00:00:00');
    const publishDate = new Date(publishedAt);
    const daysAdvance = (weekStartDate.getTime() - publishDate.getTime()) / (24 * 3600 * 1000);

    // Look up SLA for this site
    const sla = siteId
      ? db.prepare('SELECT advance_days FROM publish_ahead_sla WHERE site_id = ? AND role IS NULL').get(siteId) as any
      : null;
    const requiredAdvanceDays = sla?.advance_days ?? 14;

    let predictabilityPayExposure = 0;
    if (daysAdvance < requiredAdvanceDays) {
      predictabilityPayExposure = activeShifts.length; // all shifts are technically late
    } else {
      predictabilityPayExposure = lateChanges.length; // only changed shifts
    }

    const instabilityScore = Math.min(100, Math.round(
      (cancelledShifts.length / Math.max(1, allShifts.length)) * 30 +
      (quickReturns / Math.max(1, activeShifts.length)) * 25 +
      (callouts.length / Math.max(1, activeShifts.length)) * 25 +
      (lateChanges.length / Math.max(1, allShifts.length)) * 20
    ));

    return {
      schedule_id: schedule.id,
      week_start: schedule.week_start,
      site_id: schedule.site_id,
      status: schedule.status,
      total_shifts: allShifts.length,
      active_shifts: activeShifts.length,
      cancelled_shifts: cancelledShifts.length,
      cancellation_rate_pct: allShifts.length > 0 ? Math.round((cancelledShifts.length / allShifts.length) * 100) : 0,
      change_requests: changeRequests.length,
      late_change_count: lateChanges.length,
      quick_returns: quickReturns,
      callout_count: callouts.length,
      days_advance_published: Math.round(daysAdvance),
      required_advance_days: requiredAdvanceDays,
      predictability_pay_exposure_count: predictabilityPayExposure,
      instability_score: instabilityScore,
      instability_level: instabilityScore < 15 ? 'stable' : instabilityScore < 35 ? 'moderate' : 'volatile',
    };
  });

  res.json(results);
});

export default router;
