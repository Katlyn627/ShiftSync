import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (_req, res) => {
  const db = getDb();
  const forecasts = db.prepare('SELECT * FROM forecasts ORDER BY date').all();
  res.json(forecasts);
});

router.post('/', requireAuth, requireManager, (req, res) => {
  const { date, expected_revenue, expected_covers } = req.body;
  if (!date || expected_revenue === undefined) {
    return res.status(400).json({ error: 'date and expected_revenue are required' });
  }
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO forecasts (date, expected_revenue, expected_covers) VALUES (?, ?, ?)'
  ).run(date, expected_revenue, expected_covers ?? 0);
  const forecast = db.prepare('SELECT * FROM forecasts WHERE date = ?').get(date);
  res.status(201).json(forecast);
});

export default router;
