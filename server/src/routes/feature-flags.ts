/**
 * /api/feature-flags — Feature Flag Management (Experimentation Support)
 *
 * Supports phased rollouts, A/B experiments, and site-cluster randomization.
 * Only managers can modify flags; all authenticated users can read them.
 */
import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { logAudit } from './audit';

const router = Router();

/** GET /api/feature-flags — list all flags (respects site/rollout filtering) */
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const flags = db.prepare('SELECT * FROM feature_flags ORDER BY flag_key').all() as any[];
  const siteId = req.user?.siteId;

  // For each flag, evaluate if it's active for this user/site
  const evaluated = flags.map(f => {
    let active = !!f.enabled;
    if (active && f.rollout_pct < 100) {
      // Deterministic rollout based on user ID
      const userId = req.user?.userId ?? 0;
      const hash = (userId * 2654435761) % 100;
      active = hash < f.rollout_pct;
    }
    if (active && f.site_ids && f.site_ids !== '[]') {
      const siteIds: number[] = JSON.parse(f.site_ids);
      if (siteIds.length > 0 && siteId && !siteIds.includes(siteId)) {
        active = false;
      }
    }
    return { ...f, active_for_user: active };
  });
  res.json(evaluated);
});

/** GET /api/feature-flags/:key — single flag */
router.get('/:key', requireAuth, (req, res) => {
  const db = getDb();
  const flag = db.prepare('SELECT * FROM feature_flags WHERE flag_key = ?').get(req.params.key);
  if (!flag) return res.status(404).json({ error: 'Feature flag not found' });
  res.json(flag);
});

/** PUT /api/feature-flags/:key — update a flag */
router.put('/:key', requireManager, (req, res) => {
  const { enabled, rollout_pct, site_ids, description } = req.body;
  const db = getDb();
  const flag = db.prepare('SELECT * FROM feature_flags WHERE flag_key = ?').get(req.params.key) as any;
  if (!flag) return res.status(404).json({ error: 'Feature flag not found' });

  const updates: string[] = ['updated_at = datetime(\'now\')'];
  const params: (string | number)[] = [];

  if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  if (rollout_pct !== undefined) { updates.push('rollout_pct = ?'); params.push(Math.max(0, Math.min(100, rollout_pct))); }
  if (site_ids !== undefined) { updates.push('site_ids = ?'); params.push(JSON.stringify(site_ids)); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }

  db.prepare(`UPDATE feature_flags SET ${updates.join(', ')} WHERE flag_key = ?`).run(...params, req.params.key);

  logAudit({
    action: 'feature_flag_updated',
    entity_type: 'feature_flag',
    user_id: req.user?.userId,
    details: { flag_key: req.params.key, enabled, rollout_pct, site_ids },
  });

  const updated = db.prepare('SELECT * FROM feature_flags WHERE flag_key = ?').get(req.params.key);
  res.json(updated);
});

export default router;
