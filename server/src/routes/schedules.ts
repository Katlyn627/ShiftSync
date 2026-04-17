import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { generateSchedule, computeWeeklyStaffingNeeds } from '../scheduler';
import { getLaborCostSummary } from '../laborCost';
import { requireManager, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const schedules = siteId
    ? db.prepare('SELECT * FROM schedules WHERE site_id = ? ORDER BY week_start DESC').all(siteId)
    : db.prepare('SELECT * FROM schedules ORDER BY week_start DESC').all();
  res.json(schedules);
});

router.post('/generate', requireManager, (req: Request, res: Response) => {
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

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json(schedule);
});

router.put('/:id', requireManager, (req: Request, res: Response) => {
  const { status } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });
  if (status) db.prepare('UPDATE schedules SET status=? WHERE id=?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/shifts', (req: Request, res: Response) => {
  const db = getDb();
  const shifts = db.prepare(`
    SELECT s.*, e.name as employee_name, e.role as employee_role, e.hourly_rate
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ? AND s.status != 'cancelled'
    ORDER BY s.date, s.start_time, e.name
  `).all(req.params.id);
  res.json(shifts);
});

router.get('/:id/labor-cost', requireManager, (req: Request, res: Response) => {
  try {
    const summary = getLaborCostSummary(parseInt(req.params.id));
    res.json(summary);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;

