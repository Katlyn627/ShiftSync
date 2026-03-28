import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

/** GET /api/positions — list all active positions for the authenticated user's site */
router.get('/', requireAuth, (req, res) => {
  const siteId = req.user!.siteId;
  if (!siteId) {
    return res.status(400).json({ error: 'No site associated with your account' });
  }
  const db = getDb();
  const positions = db
    .prepare(
      `SELECT id, site_id, name, is_active, sort_order, created_at
       FROM site_positions
       WHERE site_id = ?
       ORDER BY sort_order ASC, name ASC`
    )
    .all(siteId);
  res.json(positions);
});

/** POST /api/positions — add a new position to the site (manager only) */
router.post('/', requireManager, (req, res) => {
  const siteId = req.user!.siteId;
  if (!siteId) {
    return res.status(400).json({ error: 'No site associated with your account' });
  }
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const trimmedName = name.trim();
  const db = getDb();

  // Determine next sort_order
  const maxRow = db
    .prepare('SELECT MAX(sort_order) as max_order FROM site_positions WHERE site_id = ?')
    .get(siteId) as { max_order: number | null };
  const nextOrder = (maxRow.max_order ?? -1) + 1;

  try {
    const result = db
      .prepare(
        'INSERT INTO site_positions (site_id, name, sort_order) VALUES (?, ?, ?)'
      )
      .run(siteId, trimmedName, nextOrder);
    const position = db
      .prepare('SELECT * FROM site_positions WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(position);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Position already exists for this site' });
    }
    throw err;
  }
});

/** PUT /api/positions/:id — rename or toggle a position (manager only) */
router.put('/:id', requireManager, (req, res) => {
  const siteId = req.user!.siteId;
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM site_positions WHERE id = ? AND site_id = ?')
    .get(req.params.id, siteId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Position not found' });
  }

  const { name, is_active } = req.body;
  const newName = (name !== undefined ? String(name).trim() : null) || existing.name;
  const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

  try {
    db.prepare(
      'UPDATE site_positions SET name = ?, is_active = ? WHERE id = ? AND site_id = ?'
    ).run(newName, newActive, req.params.id, siteId);
    const updated = db.prepare('SELECT * FROM site_positions WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'A position with that name already exists for this site' });
    }
    throw err;
  }
});

/** DELETE /api/positions/:id — remove a position (manager only) */
router.delete('/:id', requireManager, (req, res) => {
  const siteId = req.user!.siteId;
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM site_positions WHERE id = ? AND site_id = ?')
    .get(req.params.id, siteId);
  if (!existing) {
    return res.status(404).json({ error: 'Position not found' });
  }
  db.prepare('DELETE FROM site_positions WHERE id = ? AND site_id = ?').run(req.params.id, siteId);
  res.json({ success: true });
});

export default router;
