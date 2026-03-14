/**
 * /api/change-requests — Schedule Change Request Workflow
 *
 * When a schedule is published, changes must go through a structured workflow:
 * - Manager submits a change with a reason code
 * - Worker is notified and can consent or reject
 * - Audit trail records every state transition
 * - Predictability-pay exposure is tracked
 */
import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { logAudit } from './audit';

const router = Router();

const VALID_REASON_CODES = ['operational', 'personal', 'weather', 'event', 'callout_coverage', 'demand_change', 'other'] as const;
const VALID_CHANGE_TYPES = ['reschedule', 'cancel', 'role_change', 'time_adjustment'] as const;

/** GET /api/change-requests — list change requests */
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const isManager = req.user?.isManager;
  const employeeId = req.user?.employeeId;

  let rows: any[];
  if (isManager) {
    const cond = siteId !== null ? 'WHERE e.site_id = ?' : '';
    rows = db.prepare(`
      SELECT cr.*, e.name as employee_name, e.role as employee_role,
        s.date as shift_date, s.start_time as shift_start, s.end_time as shift_end
      FROM schedule_change_requests cr
      JOIN shifts s ON cr.shift_id = s.id
      JOIN employees e ON s.employee_id = e.id
      ${cond}
      ORDER BY cr.created_at DESC
    `).all(...(siteId !== null ? [siteId] : [])) as any[];
  } else {
    // Employees only see their own change requests
    rows = employeeId ? db.prepare(`
      SELECT cr.*, e.name as employee_name, e.role as employee_role,
        s.date as shift_date, s.start_time as shift_start, s.end_time as shift_end
      FROM schedule_change_requests cr
      JOIN shifts s ON cr.shift_id = s.id
      JOIN employees e ON s.employee_id = e.id
      WHERE s.employee_id = ?
      ORDER BY cr.created_at DESC
    `).all(employeeId) as any[] : [];
  }
  res.json(rows);
});

/** POST /api/change-requests — manager submits a change request */
router.post('/', requireManager, (req, res) => {
  const {
    shift_id, change_type, reason_code, reason_detail,
    new_date, new_start_time, new_end_time,
  } = req.body;

  if (!shift_id || !change_type || !reason_code) {
    return res.status(400).json({ error: 'shift_id, change_type, and reason_code are required' });
  }
  if (!VALID_CHANGE_TYPES.includes(change_type)) {
    return res.status(400).json({ error: `change_type must be one of: ${VALID_CHANGE_TYPES.join(', ')}` });
  }
  if (!VALID_REASON_CODES.includes(reason_code)) {
    return res.status(400).json({ error: `reason_code must be one of: ${VALID_REASON_CODES.join(', ')}` });
  }

  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id) as any;
  if (!shift) return res.status(404).json({ error: 'Shift not found' });

  // Determine if worker consent is required (schedule published)
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(shift.schedule_id) as any;
  const requiresConsent = schedule?.status === 'published' ? 1 : 0;

  const result = db.prepare(`
    INSERT INTO schedule_change_requests
      (shift_id, requested_by, change_type, reason_code, reason_detail,
       original_date, original_start_time, original_end_time,
       new_date, new_start_time, new_end_time, worker_consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    shift_id, req.user?.userId, change_type, reason_code, reason_detail ?? null,
    shift.date, shift.start_time, shift.end_time,
    new_date ?? null, new_start_time ?? null, new_end_time ?? null,
    requiresConsent ? 'pending' : 'not_required'
  );

  logAudit({
    action: 'change_request_submitted',
    entity_type: 'shift',
    entity_id: shift_id,
    user_id: req.user?.userId,
    details: { change_type, reason_code, requires_consent: !!requiresConsent, new_date, new_start_time, new_end_time },
  });

  const cr = db.prepare('SELECT * FROM schedule_change_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(cr);
});

/** PUT /api/change-requests/:id/consent — worker acknowledges/consents/rejects */
router.put('/:id/consent', requireAuth, (req, res) => {
  const { decision } = req.body; // 'accepted' | 'rejected'
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be "accepted" or "rejected"' });
  }

  const db = getDb();
  const cr = db.prepare('SELECT * FROM schedule_change_requests WHERE id = ?').get(req.params.id) as any;
  if (!cr) return res.status(404).json({ error: 'Change request not found' });

  // Verify the worker owns the shift
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(cr.shift_id) as any;
  if (shift?.employee_id !== req.user?.employeeId) {
    return res.status(403).json({ error: 'You can only consent to changes for your own shifts' });
  }
  if (cr.worker_consent !== 'pending') {
    return res.status(400).json({ error: `Consent already recorded: ${cr.worker_consent}` });
  }

  db.prepare('UPDATE schedule_change_requests SET worker_consent=? WHERE id=?').run(decision, req.params.id);

  logAudit({
    action: `change_request_consent_${decision}`,
    entity_type: 'shift',
    entity_id: cr.shift_id,
    user_id: req.user?.userId,
    details: { change_request_id: cr.id, decision },
  });

  const updated = db.prepare('SELECT * FROM schedule_change_requests WHERE id = ?').get(req.params.id);
  res.json(updated);
});

/** PUT /api/change-requests/:id/approve — manager approves and applies the change */
router.put('/:id/approve', requireManager, (req, res) => {
  const { manager_notes } = req.body;
  const db = getDb();
  const cr = db.prepare('SELECT * FROM schedule_change_requests WHERE id = ?').get(req.params.id) as any;
  if (!cr) return res.status(404).json({ error: 'Change request not found' });
  if (cr.status !== 'pending') return res.status(400).json({ error: 'Change request is not pending' });

  db.prepare("UPDATE schedule_change_requests SET status='approved', manager_notes=? WHERE id=?")
    .run(manager_notes ?? null, req.params.id);

  // Apply the change to the shift
  const updates: string[] = [];
  const params: (string | number)[] = [];
  if (cr.new_date)       { updates.push('date = ?');       params.push(cr.new_date); }
  if (cr.new_start_time) { updates.push('start_time = ?'); params.push(cr.new_start_time); }
  if (cr.new_end_time)   { updates.push('end_time = ?');   params.push(cr.new_end_time); }
  if (cr.change_type === 'cancel') { updates.push("status = 'cancelled'"); }
  if (updates.length > 0) {
    db.prepare(`UPDATE shifts SET ${updates.join(', ')} WHERE id = ?`).run(...params, cr.shift_id);
  }

  logAudit({
    action: 'change_request_approved',
    entity_type: 'shift',
    entity_id: cr.shift_id,
    user_id: req.user?.userId,
    details: { change_request_id: cr.id, change_type: cr.change_type, reason_code: cr.reason_code },
  });

  const updated = db.prepare('SELECT * FROM schedule_change_requests WHERE id = ?').get(req.params.id);
  res.json(updated);
});

/** PUT /api/change-requests/:id/reject — manager rejects */
router.put('/:id/reject', requireManager, (req, res) => {
  const { manager_notes } = req.body;
  const db = getDb();
  const cr = db.prepare('SELECT * FROM schedule_change_requests WHERE id = ?').get(req.params.id) as any;
  if (!cr) return res.status(404).json({ error: 'Change request not found' });
  if (cr.status !== 'pending') return res.status(400).json({ error: 'Change request is not pending' });

  db.prepare("UPDATE schedule_change_requests SET status='rejected', manager_notes=? WHERE id=?")
    .run(manager_notes ?? null, req.params.id);

  logAudit({
    action: 'change_request_rejected',
    entity_type: 'shift',
    entity_id: cr.shift_id,
    user_id: req.user?.userId,
    details: { change_request_id: cr.id },
  });

  const updated = db.prepare('SELECT * FROM schedule_change_requests WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
