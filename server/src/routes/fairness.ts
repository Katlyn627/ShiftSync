import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { calculateFairnessReport, calculateInstabilityReport } from '../fairness';

const router = Router();

// GET /api/fairness - workforce fairness report (manager only)
router.get('/', requireManager, (req: Request, res: Response) => {
  const scheduleId = req.query.schedule_id ? Number(req.query.schedule_id) : undefined;
  const siteId = req.query.site_id ? Number(req.query.site_id) : (req.user?.siteId ?? undefined);
  const weekStart = req.query.week_start ? String(req.query.week_start) : undefined;
  const weekEnd = req.query.week_end ? String(req.query.week_end) : undefined;

  try {
    const report = calculateFairnessReport({
      schedule_id: scheduleId,
      site_id: siteId,
      week_start: weekStart,
      week_end: weekEnd,
    });
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to calculate fairness report' });
  }
});

// GET /api/fairness/instability - schedule instability report (manager only)
router.get('/instability', requireManager, (req: Request, res: Response) => {
  const scheduleId = req.query.schedule_id ? Number(req.query.schedule_id) : undefined;
  const siteId = req.query.site_id ? Number(req.query.site_id) : (req.user?.siteId ?? undefined);
  const weekStart = req.query.week_start ? String(req.query.week_start) : undefined;

  const db = getDb();
  try {
    if (scheduleId) {
      const report = calculateInstabilityReport(scheduleId);
      return res.json([report]);
    }

    let schedulesQuery = 'SELECT id FROM schedules';
    const queryParams: any[] = [];

    if (siteId) {
      schedulesQuery += ' WHERE site_id = ?';
      queryParams.push(siteId);
      if (weekStart) {
        schedulesQuery += ' AND week_start = ?';
        queryParams.push(weekStart);
      }
    } else if (weekStart) {
      schedulesQuery += ' WHERE week_start = ?';
      queryParams.push(weekStart);
    }

    schedulesQuery += ' ORDER BY week_start DESC LIMIT 10';
    const schedules = db.prepare(schedulesQuery).all(...queryParams) as { id: number }[];

    const reports = schedules.map(s => calculateInstabilityReport(s.id));
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to calculate instability report' });
  }
});

export default router;

