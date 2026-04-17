import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

router.put('/:id', requireManager, (req: Request, res: Response) => {
  const { start_time, end_time, status, employee_id } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Shift not found' });

  // If reassigning employee, check their weekly hours won't exceed max
  if (employee_id !== undefined && employee_id !== existing.employee_id) {
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id) as any;
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const newStart = start_time ?? existing.start_time;
    const newEnd = end_time ?? existing.end_time;
    const [sh, sm] = newStart.split(':').map(Number);
    const [eh, em] = newEnd.split(':').map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin <= startMin) endMin += 24 * 60;
    const shiftHours = (endMin - startMin) / 60;

    // Sum hours for this employee in the same schedule, excluding this shift
    const otherShifts = db.prepare(
      "SELECT start_time, end_time FROM shifts WHERE schedule_id = ? AND employee_id = ? AND id != ? AND status != 'cancelled'"
    ).all(existing.schedule_id, employee_id, req.params.id) as any[];

    const currentHours = otherShifts.reduce((sum: number, s: any) => {
      const [s2h, s2m] = s.start_time.split(':').map(Number);
      const [e2h, e2m] = s.end_time.split(':').map(Number);
      let sMin = s2h * 60 + s2m;
      let eMin = e2h * 60 + e2m;
      if (eMin <= sMin) eMin += 24 * 60;
      return sum + (eMin - sMin) / 60;
    }, 0);

    if (currentHours + shiftHours > employee.weekly_hours_max) {
      return res.status(400).json({
        error: `${employee.name} would exceed their weekly hours limit of ${employee.weekly_hours_max}h (currently ${currentHours.toFixed(1)}h + ${shiftHours.toFixed(1)}h = ${(currentHours + shiftHours).toFixed(1)}h)`
      });
    }
  }

  db.prepare('UPDATE shifts SET start_time=?, end_time=?, status=?, employee_id=? WHERE id=?').run(
    start_time ?? existing.start_time,
    end_time ?? existing.end_time,
    status ?? existing.status,
    employee_id ?? existing.employee_id,
    req.params.id
  );
  const updated = db.prepare(`
    SELECT s.*, e.name as employee_name, e.role as employee_role, e.department as employee_department, e.hourly_rate
    FROM shifts s JOIN employees e ON s.employee_id = e.id
    WHERE s.id = ?
  `).get(req.params.id);
  res.json(updated);
});

// POST /shifts — create a new shift manually (manager only)
router.post('/', requireManager, (req: Request, res: Response) => {
  const { schedule_id, employee_id, date, start_time, end_time, role } = req.body;
  if (!schedule_id || !date || !start_time || !end_time || !role) {
    return res.status(400).json({ error: 'schedule_id, date, start_time, end_time, and role are required' });
  }
  const db = getDb();

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule_id) as any;
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  // If employee_id provided, check hours limit
  if (employee_id) {
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id) as any;
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const [sh, sm] = start_time.split(':').map(Number);
    const [eh, em] = end_time.split(':').map(Number);
    let sMin = sh * 60 + sm;
    let eMin = eh * 60 + em;
    if (eMin <= sMin) eMin += 24 * 60;
    const shiftHours = (eMin - sMin) / 60;

    const existingShifts = db.prepare(
      "SELECT start_time, end_time FROM shifts WHERE schedule_id = ? AND employee_id = ? AND status != 'cancelled'"
    ).all(schedule_id, employee_id) as any[];

    const currentHours = existingShifts.reduce((sum: number, s: any) => {
      const [s2h, s2m] = s.start_time.split(':').map(Number);
      const [e2h, e2m] = s.end_time.split(':').map(Number);
      let s2Min = s2h * 60 + s2m;
      let e2Min = e2h * 60 + e2m;
      if (e2Min <= s2Min) e2Min += 24 * 60;
      return sum + (e2Min - s2Min) / 60;
    }, 0);

    if (currentHours + shiftHours > employee.weekly_hours_max) {
      return res.status(400).json({
        error: `${employee.name} would exceed their weekly hours limit of ${employee.weekly_hours_max}h`
      });
    }
  }

  const result = db.prepare(
    "INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
  ).run(schedule_id, employee_id ?? null, date, start_time, end_time, role);

  const created = employee_id
    ? db.prepare(`
        SELECT s.*, e.name as employee_name, e.role as employee_role, e.department as employee_department, e.hourly_rate
        FROM shifts s JOIN employees e ON s.employee_id = e.id
        WHERE s.id = ?
      `).get(result.lastInsertRowid)
    : db.prepare('SELECT * FROM shifts WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(created);
});

router.post('/:id/drop', requireAuth, (req: Request, res: Response) => {
  const { reason } = req.body || {};
  const db = getDb();
  const shift = db.prepare(`
    SELECT s.*, e.site_id
    FROM shifts s
    JOIN employees e ON e.id = s.employee_id
    WHERE s.id = ?
  `).get(req.params.id) as any;
  if (!shift) return res.status(404).json({ error: 'Shift not found' });

  if (!req.user?.isManager && req.user?.employeeId !== shift.employee_id) {
    return res.status(403).json({ error: 'You can only drop your own shifts' });
  }
  if (shift.status === 'cancelled') {
    return res.status(400).json({ error: 'Shift is already cancelled' });
  }

  const existing = db.prepare(`
    SELECT * FROM shift_swaps
    WHERE shift_id = ? AND requester_id = ? AND target_id IS NULL AND status = 'pending'
  `).get(shift.id, shift.employee_id) as any;
  if (existing) {
    return res.status(400).json({ error: 'A pending drop request already exists for this shift' });
  }

  const now = Date.now();
  const rawStartTime = typeof shift.start_time === 'string' ? shift.start_time.trim() : '';
  const isoTime = /^\d{2}:\d{2}$/.test(rawStartTime)
    ? `${rawStartTime}:00`
    : (/^\d{2}:\d{2}:\d{2}$/.test(rawStartTime) ? rawStartTime : '');
  const shiftStart = isoTime ? Date.parse(`${shift.date}T${isoTime}`) : Number.NaN;
  const hoursUntilShift = Number.isFinite(shiftStart) ? (shiftStart - now) / (1000 * 60 * 60) : 0;
  const isLastMinute = hoursUntilShift <= 24;

  const tx = db.transaction(() => {
    const swapInsert = db.prepare(`
      INSERT INTO shift_swaps (shift_id, requester_id, target_id, reason, status)
      VALUES (?, ?, NULL, ?, 'pending')
    `).run(shift.id, shift.employee_id, reason ?? null);

    const effectiveReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'dropped';
    const openShiftInsert = db.prepare(`
      INSERT INTO open_shifts (
        schedule_id, site_id, source_shift_id, source_swap_id, date, start_time, end_time, role, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `).run(
      shift.schedule_id,
      shift.site_id ?? null,
      shift.id,
      swapInsert.lastInsertRowid,
      shift.date,
      shift.start_time,
      shift.end_time,
      shift.role,
      effectiveReason
    );

    db.prepare(`UPDATE shift_swaps SET open_shift_id = ? WHERE id = ?`).run(openShiftInsert.lastInsertRowid, swapInsert.lastInsertRowid);
    return swapInsert.lastInsertRowid;
  });

  const swapId = tx();
  const swap = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(swapId);
  res.status(201).json({
    swap,
    is_last_minute: isLastMinute,
    hours_until_shift: Number.isFinite(hoursUntilShift) ? Math.round(hoursUntilShift * 10) / 10 : 0,
  });
});


router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  // Managers can hard-delete; employees can only cancel their own shifts
  const existing = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Shift not found' });
  if (req.user?.isManager) {
    db.prepare('DELETE FROM shifts WHERE id = ?').run(req.params.id);
  } else {
    db.prepare("UPDATE shifts SET status='cancelled' WHERE id=?").run(req.params.id);
  }
  res.json({ success: true });
});

export default router;
