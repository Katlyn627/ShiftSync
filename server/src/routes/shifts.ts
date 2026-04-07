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
 * - Auto-creates an open shift in the marketplace so eligible employees can claim it.
 * - Notifies the manager about the drop request with the stated reason.
 * - Notifies ONLY eligible coworkers (same role, same site, passes availability
 *   and overtime checks — no unnecessary messages to ineligible employees).
 * - Always broadcasts a group message to eligible coworkers + managers so the
 *   conversation is saved and visible in the messaging UI.
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

  // Auto-create an open shift in the marketplace so eligible employees can claim it
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(shift.schedule_id) as any;
  const osResult = db.prepare(`
    INSERT INTO open_shifts (schedule_id, site_id, date, start_time, end_time, role, reason, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'dropped', ?)
  `).run(
    shift.schedule_id, shift.site_id,
    shift.date, shift.start_time, shift.end_time, shift.role,
    req.user?.userId ?? null
  );
  const openShiftId = osResult.lastInsertRowid as number;

  // Find ONLY eligible replacements — same role + same site + passes availability
  // and overtime checks. This prevents unnecessary messages to ineligible employees.
  const eligibleEmployees = findEligibleReplacements(db, shift, schedule, employeeId);

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
      data: { swap_id: swap.id, shift_id: shift.id, is_last_minute: isLastMinute, open_shift_id: openShiftId },
    });
  }

  // Notify ONLY eligible coworkers about the pickup opportunity
  const pickupTitle = isLastMinute ? '⚡ Urgent Shift Pickup Needed' : '📋 Shift Pickup Opportunity';
  const pickupBody = isLastMinute
    ? `${shift.employee_name} needs urgent coverage for their ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}). You are eligible to cover it — tap to claim it in Open Shifts.`
    : `${shift.employee_name} has dropped their ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}). You are eligible to pick it up — go to Open Shifts to claim it.`;

  for (const emp of eligibleEmployees) {
    createNotification({
      employee_id: emp.id,
      type: 'shift_pickup_needed',
      title: pickupTitle,
      body: pickupBody,
      link: '/open-shifts',
      data: { swap_id: swap.id, shift_id: shift.id, open_shift_id: openShiftId, is_last_minute: isLastMinute },
    });
  }

  // Always create a group conversation with eligible employees + managers so the
  // drop request is saved and visible in the messaging UI for all relevant parties.
  const allMemberIds: number[] = [employeeId, ...eligibleEmployees.map((e: any) => e.id)];
  for (const mgr of managers) {
    if (!allMemberIds.includes(mgr.employee_id)) allMemberIds.push(mgr.employee_id);
  }

  if (allMemberIds.length > 1) {
    const convTitle = isLastMinute
      ? `⚡ URGENT Coverage Needed – ${shift.role} ${shift.date}`
      : `Shift Drop – ${shift.role} ${shift.date}`;
    const convResult = db.prepare(`
      INSERT INTO conversations (type, title, site_id, created_by) VALUES ('group', ?, ?, ?)
    `).run(convTitle, shift.site_id, employeeId);
    const convId = convResult.lastInsertRowid as number;

    const addMember = db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id, employee_id) VALUES (?, ?)');
    for (const memberId of allMemberIds) {
      addMember.run(convId, memberId);
    }

    const eligibleCount = eligibleEmployees.length;
    const msgBody = isLastMinute
      ? `Hi team — I need to drop my ${shift.role} shift on ${shift.date} from ${shift.start_time} to ${shift.end_time} (${hoursUntilShift.toFixed(1)} hours away). Reason: ${sanitizedReason}\n\nThis message has been sent to ${eligibleCount} eligible ${shift.role}(s) in our department. Can anyone pick this up? Please respond here or go to the Open Shifts page to claim it.`
      : `Hi team — I'm looking to drop my ${shift.role} shift on ${shift.date} from ${shift.start_time} to ${shift.end_time}. Reason: ${sanitizedReason}\n\nThis opportunity has been shared with ${eligibleCount} eligible ${shift.role}(s) in our department. If you're interested, please go to the Open Shifts page to claim it or reply here.`;
    db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)').run(convId, employeeId, msgBody);
    db.prepare("UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?").run(convId);
  }

  res.status(201).json({
    swap,
    is_last_minute: isLastMinute,
    hours_until_shift: Math.round(hoursUntilShift),
    eligible_count: eligibleEmployees.length,
    open_shift_id: openShiftId,
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

/**
 * Find employees who are eligible to cover a dropped shift.
 * Eligibility requires: same role as the shift, same site, not the requester,
 * not marked unavailable on that day, no overlapping shift on the same day,
 * and would not exceed their weekly hours cap.
 */
function findEligibleReplacements(
  db: ReturnType<typeof import('../db').getDb>,
  shift: any,
  schedule: any,
  excludeEmployeeId: number
): any[] {
  // Only consider employees with the same role at the same site
  const candidates: any[] = shift.site_id
    ? (db.prepare('SELECT * FROM employees WHERE role = ? AND site_id = ? AND id != ?')
        .all(shift.role, shift.site_id, excludeEmployeeId) as any[])
    : (db.prepare('SELECT * FROM employees WHERE role = ? AND id != ?')
        .all(shift.role, excludeEmployeeId) as any[]);

  function toMinutes(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
  function shiftHoursLocal(start: string, end: string): number {
    let s = toMinutes(start); let e = toMinutes(end);
    if (e <= s) e += 24 * 60; return (e - s) / 60;
  }

  const newStart = toMinutes(shift.start_time);
  let newEnd = toMinutes(shift.end_time);
  if (newEnd <= newStart) newEnd += 24 * 60;
  const newHours = shiftHoursLocal(shift.start_time, shift.end_time);

  const eligible: any[] = [];
  for (const emp of candidates) {
    // Availability check — skip if explicitly unavailable on that day of week.
    // 'T12:00:00' is used as noon-local to avoid date-boundary issues from UTC offsets.
    const dayOfWeek = new Date(shift.date + 'T12:00:00').getDay();
    const avail = db.prepare('SELECT * FROM availability WHERE employee_id = ? AND day_of_week = ?')
      .get(emp.id, dayOfWeek) as any;
    if (avail?.availability_type === 'unavailable') continue;

    // Overlap check — skip if already scheduled at the same time on that day
    const sameDayShifts = db.prepare(
      "SELECT * FROM shifts WHERE employee_id = ? AND date = ? AND status != 'cancelled'"
    ).all(emp.id, shift.date) as any[];
    const hasOverlap = sameDayShifts.some((s: any) => {
      const sStart = toMinutes(s.start_time);
      let sEnd = toMinutes(s.end_time);
      if (sEnd <= sStart) sEnd += 24 * 60;
      return newStart < sEnd && newEnd > sStart;
    });
    if (hasOverlap) continue;

    // Weekly hours / overtime cap check
    if (schedule) {
      const weekEnd = new Date(new Date(schedule.week_start + 'T00:00:00').getTime() + 7 * 24 * 3600 * 1000)
        .toISOString().slice(0, 10);
      const weekShifts = db.prepare(
        "SELECT * FROM shifts WHERE employee_id = ? AND date >= ? AND date < ? AND status != 'cancelled'"
      ).all(emp.id, schedule.week_start, weekEnd) as any[];
      const totalHours = weekShifts.reduce((sum: number, s: any) => sum + shiftHoursLocal(s.start_time, s.end_time), 0);
      if (totalHours + newHours > emp.weekly_hours_max) continue;
    }

    eligible.push(emp);
  }
  return eligible;
}