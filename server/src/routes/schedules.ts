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

export default router;