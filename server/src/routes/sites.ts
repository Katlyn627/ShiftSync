import { Router } from 'express';
import { getDb } from '../db';
import { requireManager } from '../middleware/auth';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const sites = db.prepare('SELECT * FROM sites ORDER BY name').all();
  res.json(sites);
});

router.post('/', requireManager, (req, res) => {
  const { name, city, state, timezone, site_type } = req.body;
  if (!name || !city || !state) {
    return res.status(400).json({ error: 'name, city, and state are required' });
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO sites (name, city, state, timezone, site_type) VALUES (?, ?, ?, ?, ?)'
  ).run(name, city, state, timezone ?? 'America/New_York', site_type ?? 'restaurant');
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(site);
});

router.get('/:id', (_req, res) => {
  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(_req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json(site);
});

router.get('/:id/employees', (_req, res) => {
  const db = getDb();
  const employees = db.prepare('SELECT * FROM employees WHERE site_id = ? ORDER BY name').all(_req.params.id);
  res.json(employees);
});

export default router;
