import { Router } from 'express';
import { getDb } from '../db';
import { generateSchedule, computeWeeklyStaffingNeeds } from '../scheduler';
import { getLaborCostSummary } from '../laborCost';
import { calculateBurnoutRisks } from '../burnout';
import { getProfitabilityMetrics } from '../metrics';
import { getScheduleCoverageReport } from '../coverage';
import { getScheduleIntelligence } from '../intelligence';
import { requireManager, requireAuth } from '../middleware/auth';

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

router.get('/:id/burnout-risks', (req, res) => {
  try {
    const risks = calculateBurnoutRisks(parseInt(req.params.id));
    res.json(risks);
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