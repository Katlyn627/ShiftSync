/**
 * /api/publish-sla — Publish-Ahead SLA Configuration
 *
 * Configures the minimum number of days a schedule must be published
 * in advance, per site and optionally per role. This drives the
 * predictability-pay exposure calculation in the instability analytics.
 */
import { Router } from 'express';
import { getDb } from '../db';
import { requireManager } from '../middleware/auth';
import { logAudit } from './audit';

const router = Router();

/** GET /api/publish-sla — list SLA configs for the manager's site */
router.get('/', requireManager, (req, res) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const rows = siteId
    ? db.prepare('SELECT * FROM publish_ahead_sla WHERE site_id = ? ORDER BY role').all(siteId)
    : db.prepare('SELECT * FROM publish_ahead_sla ORDER BY site_id, role').all();
  res.json(rows);
});

/** POST /api/publish-sla — create or update SLA for a site/role */
router.post('/', requireManager, (req, res) => {
  const { site_id, role, advance_days } = req.body;
  if (!site_id || advance_days === undefined) {
    return res.status(400).json({ error: 'site_id and advance_days are required' });
  }
  const days = Math.max(0, parseInt(advance_days, 10));
  const db = getDb();
  db.prepare(`
    INSERT INTO publish_ahead_sla (site_id, role, advance_days)
    VALUES (?, ?, ?)
    ON CONFLICT(site_id, role) DO UPDATE SET advance_days=excluded.advance_days
  `).run(site_id, role ?? null, days);

  logAudit({
    action: 'publish_sla_updated',
    entity_type: 'publish_sla',
    user_id: req.user?.userId,
    details: { site_id, role, advance_days: days },
  });

  const row = db.prepare('SELECT * FROM publish_ahead_sla WHERE site_id = ? AND role IS ?').get(site_id, role ?? null);
  res.json(row);
});

/** DELETE /api/publish-sla/:id — remove an SLA config */
router.delete('/:id', requireManager, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM publish_ahead_sla WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
