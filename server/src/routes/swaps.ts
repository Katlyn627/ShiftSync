import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];

  if (!req.user?.isManager) {
    if (!req.user?.employeeId) return res.json([]);
    where.push('(ss.requester_id = ? OR ss.target_id = ?)');
    params.push(req.user.employeeId, req.user.employeeId);
  } else if (req.user.siteId != null) {
    where.push('req_emp.site_id = ?');
    params.push(req.user.siteId);
  }

  const rows = db.prepare(`
    SELECT
      ss.*,
      req_emp.name AS requester_name,
      target_emp.name AS target_name,
      s.date AS shift_date,
      s.start_time,
      s.end_time,
      s.role AS shift_role
    FROM shift_swaps ss
    JOIN employees req_emp ON req_emp.id = ss.requester_id
    LEFT JOIN employees target_emp ON target_emp.id = ss.target_id
    JOIN shifts s ON s.id = ss.shift_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ss.created_at DESC, ss.id DESC
  `).all(...params);

  res.json(rows);
});

router.post('/', requireAuth, (req: Request, res: Response) => {
  const { shift_id, requester_id, target_id, reason } = req.body || {};
  const employeeId = req.user?.employeeId;
  if (!shift_id || !requester_id) return res.status(400).json({ error: 'shift_id and requester_id are required' });
  if (!employeeId) return res.status(400).json({ error: 'Only employees can request swaps' });
  if (requester_id !== employeeId) return res.status(403).json({ error: 'requester_id must match the authenticated employee' });
  if (target_id != null && target_id === requester_id) return res.status(400).json({ error: 'target_id must be different from requester_id' });

  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id) as any;
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  if (shift.employee_id !== employeeId && !req.user?.isManager) {
    return res.status(403).json({ error: 'You can only request swaps for your own shifts' });
  }

  const existing = db.prepare(`
    SELECT * FROM shift_swaps
    WHERE shift_id = ? AND requester_id = ? AND IFNULL(target_id, 0) = IFNULL(?, 0) AND status = 'pending'
  `).get(shift_id, requester_id, target_id ?? null) as any;
  if (existing) return res.json(existing);

  const result = db.prepare(`
    INSERT INTO shift_swaps (shift_id, requester_id, target_id, reason, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(shift_id, requester_id, target_id ?? null, reason ?? null);
  const created = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id/approve', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const { manager_notes } = req.body || {};
  const swap = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(req.params.id) as any;
  if (!swap) return res.status(404).json({ error: 'Swap request not found' });
  if (swap.status !== 'pending') return res.status(400).json({ error: 'Swap request is already resolved' });

  const tx = db.transaction(() => {
    db.prepare(`UPDATE shift_swaps SET status='approved', manager_notes=? WHERE id=?`).run(manager_notes ?? null, req.params.id);
    if (swap.target_id == null) {
      db.prepare(`UPDATE shifts SET status='cancelled' WHERE id = ?`).run(swap.shift_id);
    } else {
      db.prepare(`UPDATE shifts SET status='swapped' WHERE id = ?`).run(swap.shift_id);
    }
  });
  tx();

  const updated = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.put('/:id/reject', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const { manager_notes } = req.body || {};
  const swap = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(req.params.id) as any;
  if (!swap) return res.status(404).json({ error: 'Swap request not found' });
  if (swap.status !== 'pending') return res.status(400).json({ error: 'Swap request is already resolved' });

  const tx = db.transaction(() => {
    db.prepare(`UPDATE shift_swaps SET status='rejected', manager_notes=? WHERE id=?`).run(manager_notes ?? null, req.params.id);
    if (swap.open_shift_id) {
      db.prepare(`UPDATE open_shifts SET status='cancelled' WHERE id = ?`).run(swap.open_shift_id);
      db.prepare(`UPDATE open_shift_offers SET status='rejected' WHERE open_shift_id = ? AND status='pending'`).run(swap.open_shift_id);
    }
  });
  tx();

  const updated = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
