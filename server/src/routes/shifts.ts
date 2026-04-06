import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { createNotification } from './notifications';

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
    SELECT s.*, e.name as employee_name, e.role as employee_role, e.hourly_rate
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
        SELECT s.*, e.name as employee_name, e.role as employee_role, e.hourly_rate
        FROM shifts s JOIN employees e ON s.employee_id = e.id
        WHERE s.id = ?
      `).get(result.lastInsertRowid)
    : db.prepare('SELECT * FROM shifts WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(created);
});

/**
 * POST /api/shifts/:id/drop
 * Employee drops (requests to be relieved of) their own shift.
 *
 * - Creates a pending swap request (open pickup — no target).
 * - Notifies the manager about the drop request with the stated reason.
 * - If the shift starts within 48 hours ("last-minute"), also notifies
 *   every eligible coworker (same role, same site) so they can volunteer
 *   to pick it up, and broadcasts a group message to department members.
 *
 * Body: { reason: string }
 */
router.post('/:id/drop', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  const { reason } = req.body as { reason?: string };
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A reason is required to drop a shift' });
  }
  // Strip HTML tags from the reason to prevent markup injection in message bodies
  const sanitizedReason = reason.trim().replace(/<[^>]*>/g, '');

  const shift = db.prepare(`
    SELECT s.*, e.name as employee_name, e.role as emp_role, e.department, e.site_id
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.id = ?
  `).get(req.params.id) as any;

  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  if (shift.employee_id !== employeeId) {
    return res.status(403).json({ error: 'You can only drop your own shift' });
  }
  if (shift.status === 'cancelled') {
    return res.status(400).json({ error: 'Shift is already cancelled' });
  }

  // Determine if this is last-minute (within 48 hours of shift start)
  const shiftDateTime = new Date(`${shift.date}T${shift.start_time}:00`);
  const nowMs = Date.now();
  const hoursUntilShift = (shiftDateTime.getTime() - nowMs) / (1000 * 60 * 60);
  const isLastMinute = hoursUntilShift <= 48 && hoursUntilShift >= 0;

  // Create an open swap request (no specific target — anyone can pick it up)
  const swapResult = db.prepare(
    'INSERT INTO shift_swaps (shift_id, requester_id, target_id, reason) VALUES (?, ?, NULL, ?)'
  ).run(shift.id, employeeId, sanitizedReason);

  const swap = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(swapResult.lastInsertRowid) as any;

  // Notify manager(s) at the same site
  const managers = db.prepare(`
    SELECT e.id as employee_id, e.name
    FROM users u
    JOIN employees e ON e.id = u.employee_id
    WHERE u.is_manager = 1 AND e.site_id = ?
  `).all(shift.site_id ?? null) as any[];

  const urgencyTag = isLastMinute ? ' ⚠️ LAST-MINUTE' : '';
  for (const mgr of managers) {
    createNotification({
      employee_id: mgr.employee_id,
      type: 'shift_drop_request',
      title: `Shift Drop Request${urgencyTag}`,
      body: `${shift.employee_name} needs to drop their ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}). Reason: ${sanitizedReason}`,
      link: '/swaps',
      data: { swap_id: swap.id, shift_id: shift.id, is_last_minute: isLastMinute },
    });
  }

  // If last-minute, also notify eligible coworkers and broadcast a group message
  if (isLastMinute) {
    const eligibleCoworkers = db.prepare(`
      SELECT e.id, e.name
      FROM employees e
      WHERE e.site_id = ? AND e.role = ? AND e.id != ?
    `).all(shift.site_id ?? null, shift.emp_role, employeeId) as any[];

    for (const coworker of eligibleCoworkers) {
      createNotification({
        employee_id: coworker.id,
        type: 'shift_pickup_needed',
        title: '⚡ Shift Pickup Needed',
        body: `${shift.employee_name} needs someone to cover their ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}). Can you pick it up?`,
        link: '/swaps',
        data: { swap_id: swap.id, shift_id: shift.id },
      });
    }

    // Broadcast a group message to the department so everyone sees the request
    if (shift.site_id) {
      const deptMembers = db.prepare(`
        SELECT e.id FROM employees e WHERE e.site_id = ? AND e.department = ? AND e.id != ?
      `).all(shift.site_id, shift.department ?? '', employeeId) as any[];

      const allMemberIds: number[] = [employeeId, ...deptMembers.map((m: any) => m.id)];
      // Include managers too
      for (const mgr of managers) {
        if (!allMemberIds.includes(mgr.employee_id)) allMemberIds.push(mgr.employee_id);
      }

      if (allMemberIds.length > 1) {
        const convTitle = `Coverage Needed – ${shift.role} ${shift.date}`;
        const convResult = db.prepare(`
          INSERT INTO conversations (type, title, site_id, created_by) VALUES ('group', ?, ?, ?)
        `).run(convTitle, shift.site_id, employeeId);
        const convId = convResult.lastInsertRowid as number;

        const addMember = db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id, employee_id) VALUES (?, ?)');
        for (const memberId of allMemberIds) {
          addMember.run(convId, memberId);
        }

        const msgBody = `Hi team — I need to drop my ${shift.role} shift on ${shift.date} from ${shift.start_time} to ${shift.end_time} (${hoursUntilShift.toFixed(1)} hours away). Reason: ${sanitizedReason}\n\nCan anyone pick this up? Please respond here or go to the Swaps page to claim it.`;
        db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)').run(convId, employeeId, msgBody);
        db.prepare("UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?").run(convId);
      }
    }
  }

  res.status(201).json({ swap, is_last_minute: isLastMinute, hours_until_shift: Math.round(hoursUntilShift) });
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