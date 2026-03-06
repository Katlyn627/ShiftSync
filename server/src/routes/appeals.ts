/**
 * /api/appeals — Scheduling appeal mechanism
 *
 * Employees can contest automated scheduling decisions (e.g. unfair shift allocation,
 * unexpected schedule change) by submitting an appeal. Managers review and respond
 * with notes. This provides the algorithmic fairness contestability required by the spec.
 */
import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { SchedulingAppeal } from '../types';
import { logAudit } from './audit';

const router = Router();

/**
 * GET /api/appeals
 * Managers see all appeals for their site's employees.
 * Employees see only their own appeals.
 * Query params: status (pending|approved|rejected), limit, offset
 */
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const { status, limit: limitStr, offset: offsetStr } = req.query as Record<string, string | undefined>;
  const limit  = Math.min(parseInt(limitStr  ?? '100', 10), 500);
  const offset = parseInt(offsetStr ?? '0', 10);

  const isManager = req.user?.isManager;
  const employeeId = req.user?.employeeId;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (!isManager) {
    // Employees can only see their own appeals
    if (!employeeId) return res.status(403).json({ error: 'Employee profile required' });
    conditions.push('sa.employee_id = ?');
    params.push(employeeId);
  }

  if (status) {
    conditions.push('sa.status = ?');
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT sa.*, e.name AS employee_name, e.role AS employee_role
    FROM scheduling_appeals sa
    JOIN employees e ON sa.employee_id = e.id
    ${where}
    ORDER BY sa.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json(rows);
});

/** GET /api/appeals/:id */
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const appeal = db.prepare(`
    SELECT sa.*, e.name AS employee_name, e.role AS employee_role
    FROM scheduling_appeals sa
    JOIN employees e ON sa.employee_id = e.id
    WHERE sa.id = ?
  `).get(req.params.id) as (SchedulingAppeal & { employee_name: string; employee_role: string }) | undefined;

  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });

  // Employees can only view their own
  if (!req.user?.isManager && req.user?.employeeId !== appeal.employee_id) {
    return res.status(403).json({ error: 'You can only view your own appeals' });
  }

  res.json(appeal);
});

/**
 * POST /api/appeals — Submit a new appeal (employee or manager)
 * Body: { shift_id?, reason }
 */
router.post('/', requireAuth, (req, res) => {
  const { shift_id, reason } = req.body as { shift_id?: number; reason?: string };
  if (!reason || reason.trim() === '') {
    return res.status(400).json({ error: 'reason is required' });
  }

  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(400).json({ error: 'No employee profile linked to this account' });

  // Validate shift_id if provided
  if (shift_id !== undefined && shift_id !== null) {
    const shift = db.prepare('SELECT id FROM shifts WHERE id = ?').get(shift_id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
  }

  const result = db.prepare(
    'INSERT INTO scheduling_appeals (shift_id, employee_id, reason) VALUES (?, ?, ?)'
  ).run(shift_id ?? null, employeeId, reason.trim());

  const appeal = db.prepare('SELECT * FROM scheduling_appeals WHERE id = ?').get(result.lastInsertRowid);

  logAudit({
    action: 'appeal_submitted',
    entity_type: 'scheduling_appeal',
    entity_id: result.lastInsertRowid as number,
    user_id: req.user?.userId,
    details: { shift_id: shift_id ?? null, employee_id: employeeId },
  });

  res.status(201).json(appeal);
});

/**
 * PUT /api/appeals/:id/approve — Manager approves an appeal
 * Body: { manager_notes? }
 */
router.put('/:id/approve', requireManager, (req, res) => {
  const db = getDb();
  const appeal = db.prepare('SELECT * FROM scheduling_appeals WHERE id = ?').get(req.params.id) as SchedulingAppeal | undefined;
  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
  if (appeal.status !== 'pending') {
    return res.status(409).json({ error: `Appeal is already ${appeal.status}` });
  }

  const { manager_notes } = req.body as { manager_notes?: string };
  db.prepare(
    'UPDATE scheduling_appeals SET status=?, manager_notes=? WHERE id=?'
  ).run('approved', manager_notes ?? null, req.params.id);

  logAudit({
    action: 'appeal_approved',
    entity_type: 'scheduling_appeal',
    entity_id: appeal.id,
    user_id: req.user?.userId,
    details: { employee_id: appeal.employee_id, shift_id: appeal.shift_id },
  });

  const updated = db.prepare('SELECT * FROM scheduling_appeals WHERE id = ?').get(req.params.id);
  res.json(updated);
});

/**
 * PUT /api/appeals/:id/reject — Manager rejects an appeal
 * Body: { manager_notes? }
 */
router.put('/:id/reject', requireManager, (req, res) => {
  const db = getDb();
  const appeal = db.prepare('SELECT * FROM scheduling_appeals WHERE id = ?').get(req.params.id) as SchedulingAppeal | undefined;
  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
  if (appeal.status !== 'pending') {
    return res.status(409).json({ error: `Appeal is already ${appeal.status}` });
  }

  const { manager_notes } = req.body as { manager_notes?: string };
  db.prepare(
    'UPDATE scheduling_appeals SET status=?, manager_notes=? WHERE id=?'
  ).run('rejected', manager_notes ?? null, req.params.id);

  logAudit({
    action: 'appeal_rejected',
    entity_type: 'scheduling_appeal',
    entity_id: appeal.id,
    user_id: req.user?.userId,
    details: { employee_id: appeal.employee_id, shift_id: appeal.shift_id },
  });

  const updated = db.prepare('SELECT * FROM scheduling_appeals WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
