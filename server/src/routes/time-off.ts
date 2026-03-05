import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function twoWeeksFromNow(): string {
  return new Date(Date.now() + TWO_WEEKS_MS).toISOString().slice(0, 10);
}

// GET /time-off — managers see all; employees see their own
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  if (req.user?.isManager) {
    const rows = db.prepare(`
      SELECT r.*, e.name AS employee_name
      FROM time_off_requests r
      JOIN employees e ON r.employee_id = e.id
      ORDER BY r.created_at DESC
    `).all();
    return res.json(rows);
  }
  const empId = req.user?.employeeId;
  if (!empId) return res.status(400).json({ error: 'No employee record linked to your account' });
  const rows = db.prepare(`
    SELECT r.*, e.name AS employee_name
    FROM time_off_requests r
    JOIN employees e ON r.employee_id = e.id
    WHERE r.employee_id = ?
    ORDER BY r.created_at DESC
  `).all(empId);
  return res.json(rows);
});

// POST /time-off — create a time-off request; start_date must be >= 2 weeks from today
router.post('/', requireAuth, (req, res) => {
  const empId = req.user?.employeeId;
  if (!empId && !req.user?.isManager) {
    return res.status(400).json({ error: 'No employee record linked to your account' });
  }
  const targetEmpId = req.user?.isManager && req.body.employee_id ? req.body.employee_id : empId;
  if (!targetEmpId) return res.status(400).json({ error: 'employee_id is required' });

  const { start_date, end_date, reason } = req.body;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: 'end_date must be on or after start_date' });
  }

  const minDate = twoWeeksFromNow();
  if (start_date < minDate) {
    return res.status(400).json({
      error: `Time-off requests must be submitted at least 2 weeks in advance. Earliest allowed start date is ${minDate}.`,
    });
  }

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO time_off_requests (employee_id, start_date, end_date, reason, status)
     VALUES (?, ?, ?, ?, 'pending')`
  ).run(targetEmpId, start_date, end_date, reason ?? null);

  const created = db.prepare(`
    SELECT r.*, e.name AS employee_name
    FROM time_off_requests r
    JOIN employees e ON r.employee_id = e.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);
  return res.status(201).json(created);
});

// PUT /time-off/:id/approve — manager only
router.put('/:id/approve', requireManager, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM time_off_requests WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Time-off request not found' });

  const { manager_notes } = req.body;
  db.prepare(
    `UPDATE time_off_requests SET status='approved', manager_notes=? WHERE id=?`
  ).run(manager_notes ?? null, req.params.id);

  const updated = db.prepare(`
    SELECT r.*, e.name AS employee_name
    FROM time_off_requests r
    JOIN employees e ON r.employee_id = e.id
    WHERE r.id = ?
  `).get(req.params.id);
  return res.json(updated);
});

// PUT /time-off/:id/reject — manager only
router.put('/:id/reject', requireManager, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM time_off_requests WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Time-off request not found' });

  const { manager_notes } = req.body;
  db.prepare(
    `UPDATE time_off_requests SET status='rejected', manager_notes=? WHERE id=?`
  ).run(manager_notes ?? null, req.params.id);

  const updated = db.prepare(`
    SELECT r.*, e.name AS employee_name
    FROM time_off_requests r
    JOIN employees e ON r.employee_id = e.id
    WHERE r.id = ?
  `).get(req.params.id);
  return res.json(updated);
});

// DELETE /time-off/:id — employee can delete their own pending request; manager can delete any
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM time_off_requests WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Time-off request not found' });

  if (!req.user?.isManager) {
    if (req.user?.employeeId !== existing.employee_id) {
      return res.status(403).json({ error: 'You can only cancel your own time-off requests' });
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be cancelled' });
    }
  }

  db.prepare('DELETE FROM time_off_requests WHERE id = ?').run(req.params.id);
  return res.json({ success: true });
});

export default router;
