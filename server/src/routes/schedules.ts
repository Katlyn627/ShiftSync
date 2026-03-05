import { Router } from 'express';
import { getDb } from '../db';
import { generateSchedule, computeWeeklyStaffingNeeds } from '../scheduler';
import { getLaborCostSummary } from '../laborCost';
import { calculateBurnoutRisks } from '../burnout';
import { requireManager } from '../middleware/auth';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const schedules = db.prepare('SELECT * FROM schedules ORDER BY week_start DESC').all();
  res.json(schedules);
});

router.post('/generate', requireManager, (req, res) => {
  const { week_start, labor_budget } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start is required' });
  try {
    const scheduleId = generateSchedule({ weekStart: week_start, laborBudget: labor_budget ?? 5000 });
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
    const suggestions = computeWeeklyStaffingNeeds(week_start);
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

router.get('/:id/turnover-risks', (req, res) => {
  try {
    const burnoutRisks = calculateBurnoutRisks(parseInt(req.params.id));
    const turnoverRisks = burnoutRisks.map(risk => {
      let turnover_risk: 'low' | 'medium' | 'high';
      let reason: string;
      if (risk.risk_level === 'high') {
        turnover_risk = 'high';
        reason = 'High burnout risk strongly correlates with turnover intent';
      } else if (risk.risk_level === 'medium') {
        turnover_risk = 'medium';
        reason = 'Moderate stress factors may affect long-term retention';
      } else {
        turnover_risk = 'low';
        reason = 'Schedule conditions suggest stable retention';
      }
      return {
        employee_id: risk.employee_id,
        employee_name: risk.employee_name,
        turnover_risk,
        reason,
        risk_score: risk.risk_score,
        burnout_risk: risk.risk_level,
      };
    });
    res.json(turnoverRisks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;