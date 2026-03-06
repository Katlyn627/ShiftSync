/**
 * /api/audit — Compliance audit log (read-only)
 *
 * The audit log records compliance-relevant actions (schedule publish/unpublish,
 * swap approvals, time-off decisions, shift assignments) for defensible reporting.
 * Only managers may read the log; entries are written by other route handlers.
 */
import { Router } from 'express';
import { getDb } from '../db';
import { requireManager } from '../middleware/auth';
import { AuditLog } from '../types';

const router = Router();

/**
 * GET /api/audit
 * Query params:
 *   entity_type  — filter by entity type (shift, swap, time_off, schedule, employee)
 *   entity_id    — filter by entity id
 *   user_id      — filter by acting user
 *   limit        — max rows returned (default 200, max 1000)
 *   offset       — pagination offset (default 0)
 */
router.get('/', requireManager, (req, res) => {
  const db = getDb();
  const {
    entity_type,
    entity_id,
    user_id,
    limit: limitStr,
    offset: offsetStr,
  } = req.query as Record<string, string | undefined>;

  const limit  = Math.min(parseInt(limitStr  ?? '200', 10), 1000);
  const offset = parseInt(offsetStr ?? '0', 10);

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (entity_type) { conditions.push('entity_type = ?'); params.push(entity_type); }
  if (entity_id)   { conditions.push('entity_id = ?');   params.push(parseInt(entity_id, 10)); }
  if (user_id)     { conditions.push('user_id = ?');     params.push(parseInt(user_id, 10)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as AuditLog[];

  res.json(rows);
});

/** GET /api/audit/:id — single entry */
router.get('/:id', requireManager, (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(req.params.id) as AuditLog | undefined;
  if (!entry) return res.status(404).json({ error: 'Audit log entry not found' });
  res.json(entry);
});

/**
 * Utility exported for use by other route handlers.
 * Call this whenever a compliance-relevant action occurs.
 */
export function logAudit(params: {
  action: string;
  entity_type: string;
  entity_id?: number | null;
  user_id?: number | null;
  details?: Record<string, unknown>;
}): void {
  try {
    const db = getDb();
    db.prepare(
      'INSERT INTO audit_log (action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(
      params.action,
      params.entity_type,
      params.entity_id ?? null,
      params.user_id ?? null,
      JSON.stringify(params.details ?? {})
    );
  } catch (err) {
    // Audit logging must never crash the primary operation, but log for diagnostics
    console.error('[audit] Failed to write audit entry:', err);
  }
}

export default router;
