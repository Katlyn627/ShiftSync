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
  const { name, city, state, timezone, site_type, jurisdiction } = req.body;
  if (!name || !city || !state) {
    return res.status(400).json({ error: 'name, city, and state are required' });
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO sites (name, city, state, timezone, site_type, jurisdiction) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, city, state, timezone ?? 'America/New_York', site_type ?? 'restaurant', jurisdiction ?? 'default');
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

/** PUT /api/sites/:id — update site details including jurisdiction (manager only) */
router.put('/:id', requireManager, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Site not found' });

  const { name, city, state, timezone, site_type, jurisdiction } = req.body;
  db.prepare(
    'UPDATE sites SET name=?, city=?, state=?, timezone=?, site_type=?, jurisdiction=? WHERE id=?'
  ).run(
    name ?? existing.name,
    city ?? existing.city,
    state ?? existing.state,
    timezone ?? existing.timezone,
    site_type ?? existing.site_type,
    jurisdiction ?? existing.jurisdiction,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
