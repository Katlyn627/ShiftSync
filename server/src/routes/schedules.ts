import { Router } from 'express';
import { getDb } from '../db';
import { generateSchedule, computeWeeklyStaffingNeeds } from '../scheduler';
import { getLaborCostSummary } from '../laborCost';
import { calculateBurnoutRisks } from '../burnout';
import { getProfitabilityMetrics } from '../metrics';
import { getScheduleCoverageReport } from '../coverage';
import { getScheduleIntelligence } from '../intelligence';
import { requireManager, requireAuth } from '../middleware/auth';
import { logAudit } from './audit';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const schedules = siteId
    ? db.prepare('SELECT * FROM schedules WHERE site_id = ? ORDER BY week_start DESC').all(siteId)
    : db.prepare('SELECT * FROM schedules ORDER BY week_start DESC').all();
  res.json(schedules);
});

router.post('/generate', requireManager, (req, res) => {
  const { week_start, labor_budget } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start is required' });
  try {
    const siteId = req.user?.siteId ?? null;
    const scheduleId = generateSchedule({ weekStart: week_start, laborBudget: labor_budget ?? 5000, siteId });
    const db = getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
    logAudit({
      action: 'schedule_generated',
      entity_type: 'schedule',
      entity_id: scheduleId,
      user_id: req.user?.userId,
      details: { week_start, labor_budget: labor_budget ?? 5000, site_id: siteId },
    });
    res.status(201).json(schedule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/staffing-suggestions', requireManager, (req, res) => {
  const { week_start } = req.query;
  if (!week_start || typeof week_start !== 'string') {
    return res.status(400).json({ error: 'week_start query parameter is required' });
  }
  try {
    const siteId = req.user?.siteId ?? null;
    const suggestions = computeWeeklyStaffingNeeds(week_start, siteId);
    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json(schedule);
});

router.put('/:id', requireManager, (req, res) => {
  const { status } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });

  // Publish-ahead SLA enforcement
  if (status === 'published') {
    const sla = existing.site_id
      ? db.prepare('SELECT advance_days FROM publish_ahead_sla WHERE site_id = ? AND role IS NULL').get(existing.site_id) as any
      : null;
    if (sla) {
      const weekStartDate = new Date(existing.week_start + 'T00:00:00').getTime();
      const now = Date.now();
      const daysUntilStart = (weekStartDate - now) / (24 * 3600 * 1000);
      if (daysUntilStart < sla.advance_days) {
        return res.status(422).json({
          error: `Publish-ahead SLA violation: schedule must be published at least ${sla.advance_days} days before the week starts. Currently ${Math.round(daysUntilStart)} days away.`,
          sla_advance_days: sla.advance_days,
          days_until_start: Math.round(daysUntilStart),
          can_override: true,
        });
      }
    }
  }

  if (status) db.prepare('UPDATE schedules SET status=? WHERE id=?').run(status, req.params.id);
  if (status) {
    logAudit({
      action: `schedule_${status}`,
      entity_type: 'schedule',
      entity_id: parseInt(req.params.id, 10),
      user_id: req.user?.userId,
      details: { previous_status: existing.status, new_status: status },
    });
  }
  const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', requireManager, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/shifts', (req, res) => {
  const db = getDb();
  const shifts = db.prepare(`
    SELECT s.*, e.name as employee_name, e.role as employee_role, e.hourly_rate
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ?
    ORDER BY s.date, s.start_time, e.name
  `).all(req.params.id);
  res.json(shifts);
});

router.get('/:id/labor-cost', requireManager, (req, res) => {
  try {
    const summary = getLaborCostSummary(parseInt(req.params.id));
    res.json(summary);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/burnout-risks', requireAuth, (req, res) => {
  try {
    const risks = calculateBurnoutRisks(parseInt(req.params.id));
    const isManager = req.user?.isManager;

    if (isManager) {
      // Managers see full individual-level burnout data
      return res.json(risks);
    }

    // Non-managers: only return their own entry (if it exists) plus an anonymised aggregate
    // to prevent re-identification from small group scores.
    const employeeId = req.user?.employeeId;
    const own = risks.find(r => r.employee_id === employeeId) ?? null;

    // Aggregate summary — always safe to expose (no individual identification)
    const summary = {
      total_employees: risks.length,
      high_risk_count: risks.filter(r => r.risk_level === 'high').length,
      medium_risk_count: risks.filter(r => r.risk_level === 'medium').length,
      low_risk_count: risks.filter(r => r.risk_level === 'low').length,
      // Expose averages only; never expose individual non-self scores
      avg_risk_score: risks.length
        ? Math.round(risks.reduce((s, r) => s + r.risk_score, 0) / risks.length)
        : 0,
    };

    return res.json({ own, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/profitability-metrics', requireManager, (req, res) => {
  try {
    const metrics = getProfitabilityMetrics(parseInt(req.params.id));
    res.json(metrics);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/coverage', (req, res) => {
  try {
    const report = getScheduleCoverageReport(parseInt(req.params.id));
    res.json(report);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/intelligence', requireManager, (req, res) => {
  try {
    const intel = getScheduleIntelligence(parseInt(req.params.id));
    res.json(intel);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/instability', requireManager, (req, res) => {
  try {
    const db = getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as any;
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const allShifts = db.prepare("SELECT * FROM shifts WHERE schedule_id = ?").all(req.params.id) as any[];
    const cancelledShifts = allShifts.filter(s => s.status === 'cancelled');
    const activeShifts = allShifts.filter(s => s.status !== 'cancelled');

    const shiftIds = allShifts.map(s => s.id);
    const changeRequests = shiftIds.length > 0
      ? db.prepare(`SELECT * FROM schedule_change_requests WHERE shift_id IN (${shiftIds.map(() => '?').join(',')})`).all(...shiftIds) as any[]
      : [];

    const lateChanges = changeRequests.filter(cr => {
      if (!cr.original_date) return false;
      const daysBefore = (new Date(cr.original_date).getTime() - new Date(cr.created_at).getTime()) / (24 * 3600 * 1000);
      return daysBefore < 14;
    });

    const callouts = db.prepare(`
      SELECT ce.* FROM callout_events ce JOIN shifts s ON ce.shift_id = s.id WHERE s.schedule_id = ?
    `).all(req.params.id) as any[];

    // Quick returns
    let quickReturns = 0;
    const compRule = db.prepare("SELECT rule_value FROM compliance_rules WHERE jurisdiction = 'default' AND rule_type = 'min_rest_hours'").get() as any;
    const minRest = compRule ? parseFloat(compRule.rule_value) : 10;
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    const byEmp: Record<number, any[]> = {};
    for (const s of activeShifts) {
      if (!byEmp[s.employee_id]) byEmp[s.employee_id] = [];
      byEmp[s.employee_id].push(s);
    }
    for (const empShifts of Object.values(byEmp)) {
      const sorted = [...empShifts].sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]; const curr = sorted[i];
        if (prev.date === curr.date) continue;
        const prevMs = new Date(prev.date + 'T00:00:00').getTime();
        const currMs = new Date(curr.date + 'T00:00:00').getTime();
        if ((currMs - prevMs) / (24 * 3600 * 1000) === 1) {
          const gap = (24 * 60 - toMin(prev.end_time)) + toMin(curr.start_time);
          if (gap < minRest * 60) quickReturns++;
        }
      }
    }

    const sla = schedule.site_id
      ? db.prepare('SELECT advance_days FROM publish_ahead_sla WHERE site_id = ? AND role IS NULL').get(schedule.site_id) as any
      : null;
    const requiredAdvanceDays = sla?.advance_days ?? 14;
    const daysAdvance = (new Date(schedule.week_start + 'T00:00:00').getTime() - new Date(schedule.created_at).getTime()) / (24 * 3600 * 1000);
    const predictabilityPayExposure = daysAdvance < requiredAdvanceDays ? activeShifts.length : lateChanges.length;

    const instabilityScore = Math.min(100, Math.round(
      (cancelledShifts.length / Math.max(1, allShifts.length)) * 30 +
      (quickReturns / Math.max(1, activeShifts.length)) * 25 +
      (callouts.length / Math.max(1, activeShifts.length)) * 25 +
      (lateChanges.length / Math.max(1, allShifts.length)) * 20
    ));

    res.json({
      schedule_id: parseInt(req.params.id, 10),
      week_start: schedule.week_start,
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
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;