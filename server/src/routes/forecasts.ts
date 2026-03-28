import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const forecasts = siteId
    ? db.prepare('SELECT * FROM forecasts WHERE site_id = ? ORDER BY date').all(siteId)
    : db.prepare('SELECT * FROM forecasts ORDER BY date').all();
  res.json(forecasts);
});

router.post('/', requireAuth, (req: Request, res: Response) => {
  const { date, expected_revenue, expected_covers } = req.body;
  if (!date || expected_revenue === undefined) {
    return res.status(400).json({ error: 'date and expected_revenue are required' });
  }
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  db.prepare(
    'INSERT OR REPLACE INTO forecasts (date, site_id, expected_revenue, expected_covers) VALUES (?, ?, ?, ?)'
  ).run(date, siteId, expected_revenue, expected_covers ?? 0);
  const forecast = siteId
    ? db.prepare('SELECT * FROM forecasts WHERE date = ? AND site_id = ?').get(date, siteId)
    : db.prepare('SELECT * FROM forecasts WHERE date = ? AND site_id IS NULL').get(date);
  res.status(201).json(forecast);
});

export default router;