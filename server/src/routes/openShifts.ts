import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const { status, date_from, date_to } = req.query;
  const where: string[] = [];
  const params: any[] = [];

  if (typeof status === 'string' && status.trim()) {
    where.push('os.status = ?');
    params.push(status.trim());
  }
  if (typeof date_from === 'string' && date_from.trim()) {
    where.push('os.date >= ?');
    params.push(date_from.trim());
  }
  if (typeof date_to === 'string' && date_to.trim()) {
    where.push('os.date <= ?');
    params.push(date_to.trim());
  }
  if (req.user?.siteId != null) {
    where.push('(os.site_id = ? OR os.site_id IS NULL)');
    params.push(req.user.siteId);
  }

  const rows = db.prepare(`
    SELECT
      os.*,
      claimer.name AS claimed_by_name,
      (
        SELECT COUNT(*)
        FROM open_shift_offers oso
        WHERE oso.open_shift_id = os.id AND oso.status = 'pending'
      ) AS offer_count
    FROM open_shifts os
    LEFT JOIN employees claimer ON claimer.id = os.claimed_by
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY os.date ASC, os.start_time ASC, os.id ASC
  `).all(...params);

  res.json(rows);
});

router.get('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT os.*, claimer.name AS claimed_by_name
    FROM open_shifts os
    LEFT JOIN employees claimer ON claimer.id = os.claimed_by
    WHERE os.id = ?
  `).get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Open shift not found' });
  res.json(row);
});

router.post('/', requireManager, (req: Request, res: Response) => {
  const { schedule_id, site_id, date, start_time, end_time, role, required_certifications, reason, deadline } = req.body || {};
  if (!schedule_id || !date || !start_time || !end_time || !role) {
    return res.status(400).json({ error: 'schedule_id, date, start_time, end_time, and role are required' });
  }
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule_id) as any;
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  const certificationsJson = Array.isArray(required_certifications)
    ? JSON.stringify(required_certifications.filter((c: unknown) => typeof c === 'string'))
    : '[]';
  const effectiveSiteId = site_id ?? req.user?.siteId ?? schedule.site_id ?? null;
  const result = db.prepare(`
    INSERT INTO open_shifts (schedule_id, site_id, date, start_time, end_time, role, required_certifications, reason, deadline, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
  `).run(
    schedule_id,
    effectiveSiteId,
    date,
    start_time,
    end_time,
    role,
    certificationsJson,
    reason ?? null,
    deadline ?? null
  );
  const created = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.post('/:id/offer', requireAuth, (req: Request, res: Response) => {
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(400).json({ error: 'Only employees can offer for open shifts' });
  const db = getDb();
  const openShift = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(req.params.id) as any;
  if (!openShift) return res.status(404).json({ error: 'Open shift not found' });
  if (openShift.status !== 'open') return res.status(400).json({ error: 'Open shift is not available' });

  const existing = db.prepare(`
    SELECT * FROM open_shift_offers
    WHERE open_shift_id = ? AND employee_id = ? AND status IN ('pending', 'accepted')
  `).get(req.params.id, employeeId) as any;
  if (existing) return res.json(existing);

  const result = db.prepare(`
    INSERT INTO open_shift_offers (open_shift_id, employee_id, status)
    VALUES (?, ?, 'pending')
  `).run(req.params.id, employeeId);
  const created = db.prepare('SELECT * FROM open_shift_offers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id/fill', requireManager, (req: Request, res: Response) => {
  const { employee_id } = req.body || {};
  if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });
  const db = getDb();
  const openShift = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(req.params.id) as any;
  if (!openShift) return res.status(404).json({ error: 'Open shift not found' });
  if (openShift.status !== 'open') return res.status(400).json({ error: 'Open shift is not available' });

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id) as any;
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const tx = db.transaction(() => {
    const shiftResult = db.prepare(`
      INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status)
      VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
    `).run(openShift.schedule_id, employee_id, openShift.date, openShift.start_time, openShift.end_time, openShift.role);
    db.prepare(`UPDATE open_shifts SET status='claimed', claimed_by=? WHERE id=?`).run(employee_id, req.params.id);
    db.prepare(`UPDATE open_shift_offers SET status='accepted' WHERE open_shift_id=? AND employee_id=?`).run(req.params.id, employee_id);
    db.prepare(`UPDATE open_shift_offers SET status='rejected' WHERE open_shift_id=? AND employee_id!=? AND status='pending'`).run(req.params.id, employee_id);
    return shiftResult.lastInsertRowid;
  });

  const shiftId = tx();
  const updatedOpenShift = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(req.params.id);
  res.json({ open_shift: updatedOpenShift, shift_id: shiftId });
});

router.delete('/:id', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const openShift = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(req.params.id) as any;
  if (!openShift) return res.status(404).json({ error: 'Open shift not found' });
  db.prepare(`UPDATE open_shifts SET status='cancelled' WHERE id = ?`).run(req.params.id);
  db.prepare(`UPDATE open_shift_offers SET status='rejected' WHERE open_shift_id = ? AND status='pending'`).run(req.params.id);
  res.json({ success: true });
});

export default router;
