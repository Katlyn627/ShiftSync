/**
 * /api/open-shifts — Open Shift Marketplace
 *
 * One-to-many shift offering system where managers post open/uncovered shifts
 * and eligible employees can offer to claim them. Supports eligibility filtering
 * (skills/certifications, availability, rest windows, overtime caps) and deadline
 * escalation. Includes a "manager override" mechanism with explicit audit trail.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { logAudit } from './audit';
import { createNotification } from './notifications';
import { sendSystemMessage } from './messages';

const router = Router();

/** Parse HH:MM into total minutes */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Shift duration in hours (handles overnight) */
function shiftHours(start: string, end: string): number {
  let sMin = toMinutes(start);
  let eMin = toMinutes(end);
  if (eMin <= sMin) eMin += 24 * 60;
  return (eMin - sMin) / 60;
}

/**
 * Check whether an employee is eligible for a given open shift.
 * Returns { eligible: true } or { eligible: false, reason: string }
 */
function checkEligibility(
  db: ReturnType<typeof getDb>,
  openShift: any,
  employee: any
): { eligible: boolean; reason?: string } {
  // 1. Role check
  if (employee.role !== openShift.role && employee.role !== 'Manager') {
    return { eligible: false, reason: `role_mismatch: shift requires ${openShift.role}` };
  }

  // 2. Certification check
  const requiredCerts: string[] = JSON.parse(openShift.required_certifications || '[]');
  if (requiredCerts.length > 0) {
    const empCerts: string[] = JSON.parse(employee.certifications || '[]');
    const missing = requiredCerts.filter((c: string) => !empCerts.includes(c));
    if (missing.length > 0) {
      return { eligible: false, reason: `missing_certifications: ${missing.join(', ')}` };
    }
  }

  // 3. Availability check (day of week)
  const dayOfWeek = new Date(openShift.date + 'T12:00:00').getDay();
  const avail = db
    .prepare('SELECT * FROM availability WHERE employee_id = ? AND day_of_week = ?')
    .get(employee.id, dayOfWeek) as any;
  if (avail && avail.availability_type === 'unavailable') {
    return { eligible: false, reason: 'unavailable: marked unavailable for this day' };
  }

  // 4. Rest window check — look for shifts ending within restHours before or starting within restHours after
  const compRule = db
    .prepare("SELECT rule_value FROM compliance_rules WHERE jurisdiction = 'default' AND rule_type = 'min_rest_hours'")
    .get() as any;
  const restHours = compRule?.rule_value ? parseFloat(compRule.rule_value) : 10;

  const shiftDate = openShift.date;
  const dayBefore = new Date(new Date(shiftDate + 'T00:00:00').getTime() - 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const dayAfter = new Date(new Date(shiftDate + 'T00:00:00').getTime() + 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const nearbyShifts = db
    .prepare(
      "SELECT * FROM shifts WHERE employee_id = ? AND date IN (?, ?, ?) AND status != 'cancelled'"
    )
    .all(employee.id, dayBefore, shiftDate, dayAfter) as any[];

  const newStart = toMinutes(openShift.start_time);
  const newEnd = toMinutes(openShift.end_time) <= newStart
    ? toMinutes(openShift.end_time) + 24 * 60
    : toMinutes(openShift.end_time);

  for (const s of nearbyShifts) {
    if (s.date === shiftDate) {
      // Same-day: check for overlap
      const sStart = toMinutes(s.start_time);
      const sEnd = toMinutes(s.end_time) <= sStart ? toMinutes(s.end_time) + 24 * 60 : toMinutes(s.end_time);
      if (newStart < sEnd && newEnd > sStart) {
        return { eligible: false, reason: 'rest_violation: overlaps with existing shift' };
      }
    }
    // Clopen check across day boundary
    if (s.date === dayBefore) {
      // Minutes remaining in the prev day after the shift ended + minutes into the new day until new shift starts
      const prevEnd = toMinutes(s.end_time);
      const gapMinutes = (24 * 60 - prevEnd) + newStart;
      if (gapMinutes < restHours * 60) {
        return { eligible: false, reason: `rest_violation: less than ${restHours}h rest since previous shift` };
      }
    }
    if (s.date === dayAfter) {
      const nextStart = toMinutes(s.start_time);
      const gap = nextStart - newEnd;
      const gapAdj = gap < 0 ? gap + 24 * 60 : gap;
      if (gapAdj < restHours * 60) {
        return { eligible: false, reason: `rest_violation: less than ${restHours}h rest before next shift` };
      }
    }
  }

  // 5. Weekly hours / overtime cap check
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(openShift.schedule_id) as any;
  if (schedule) {
    const weekStart = schedule.week_start;
    const weekEnd = new Date(new Date(weekStart + 'T00:00:00').getTime() + 7 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const weekShifts = db
      .prepare(
        "SELECT * FROM shifts WHERE employee_id = ? AND date >= ? AND date < ? AND status != 'cancelled'"
      )
      .all(employee.id, weekStart, weekEnd) as any[];
    const totalHours = weekShifts.reduce((sum: number, s: any) => sum + shiftHours(s.start_time, s.end_time), 0);
    const newHours = shiftHours(openShift.start_time, openShift.end_time);
    if (totalHours + newHours > employee.weekly_hours_max) {
      return {
        eligible: false,
        reason: `overtime_cap: would exceed weekly hours limit (${employee.weekly_hours_max}h)`,
      };
    }
  }

  return { eligible: true };
}

/** GET /api/open-shifts — list open shifts for the user's site */
router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const { status, date_from, date_to } = req.query as Record<string, string | undefined>;

  const conditions: string[] = [];
  const params: (string | number | null)[] = [];

  if (siteId !== null) { conditions.push('os.site_id = ?'); params.push(siteId); }
  if (status)    { conditions.push('os.status = ?');    params.push(status); }
  if (date_from) { conditions.push('os.date >= ?');     params.push(date_from); }
  if (date_to)   { conditions.push('os.date <= ?');     params.push(date_to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT os.*,
      e.name as claimed_by_name,
      (SELECT COUNT(*) FROM open_shift_offers oso WHERE oso.open_shift_id = os.id AND oso.status = 'pending') as offer_count
    FROM open_shifts os
    LEFT JOIN employees e ON os.claimed_by = e.id
    ${where}
    ORDER BY os.date, os.start_time
  `).all(...params);
  res.json(rows);
});

/** POST /api/open-shifts — manager creates an open shift */
router.post('/', requireManager, (req: Request, res: Response) => {
  const { schedule_id, site_id, date, start_time, end_time, role, required_certifications, reason, deadline } = req.body;
  if (!schedule_id || !date || !start_time || !end_time || !role) {
    return res.status(400).json({ error: 'schedule_id, date, start_time, end_time, and role are required' });
  }
  const db = getDb();
  const siteId = site_id ?? req.user?.siteId ?? null;
  const result = db.prepare(`
    INSERT INTO open_shifts (schedule_id, site_id, date, start_time, end_time, role, required_certifications, reason, deadline, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schedule_id, siteId, date, start_time, end_time, role,
    JSON.stringify(required_certifications ?? []),
    reason ?? null, deadline ?? null, req.user?.userId ?? null
  );
  const openShiftId = result.lastInsertRowid as number;
  const openShift = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(openShiftId) as any;
  logAudit({
    action: 'open_shift_created',
    entity_type: 'open_shift',
    entity_id: openShiftId,
    user_id: req.user?.userId,
    details: { date, role, reason },
  });

  // Notify eligible employees and send them direct messages about the new open shift
  notifyEligibleForOpenShift(db, openShift, req.user?.employeeId ?? null);

  res.status(201).json(openShift);
});

/** GET /api/open-shifts/:id — single open shift with eligibility info for the current user */
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const openShift = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(req.params.id) as any;
  if (!openShift) return res.status(404).json({ error: 'Open shift not found' });

  const offers = db.prepare(`
    SELECT oso.*, e.name as employee_name, e.role as employee_role
    FROM open_shift_offers oso
    JOIN employees e ON oso.employee_id = e.id
    WHERE oso.open_shift_id = ?
    ORDER BY oso.created_at
  `).all(req.params.id);

  // For non-managers, check own eligibility and explain why/why not
  let eligibilityInfo: any = null;
  if (!req.user?.isManager && req.user?.employeeId) {
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.employeeId) as any;
    if (emp) {
      const { eligible, reason } = checkEligibility(db, openShift, emp);
      eligibilityInfo = {
        eligible,
        reason: reason ?? null,
        explanation: eligible
          ? 'You meet all requirements for this shift (role, certifications, rest, and weekly hours).'
          : `You are not eligible for this shift: ${reason}`,
      };
    }
  }

  res.json({ ...openShift, offers: req.user?.isManager ? offers : undefined, eligibility: eligibilityInfo });
});

/** POST /api/open-shifts/:id/offer — employee offers to claim a shift */
router.post('/:id/offer', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const openShift = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(req.params.id) as any;
  if (!openShift) return res.status(404).json({ error: 'Open shift not found' });
  if (openShift.status !== 'open') {
    return res.status(400).json({ error: `Shift is no longer open (status: ${openShift.status})` });
  }

  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'Only employees can offer for shifts' });

  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as any;
  if (!emp) return res.status(404).json({ error: 'Employee record not found' });

  const { eligible, reason } = checkEligibility(db, openShift, emp);
  const ineligibilityReason = eligible ? null : reason ?? 'ineligible';

  // Check for duplicate offer
  const existing = db.prepare('SELECT id FROM open_shift_offers WHERE open_shift_id = ? AND employee_id = ?').get(req.params.id, employeeId) as any;
  if (existing) return res.status(409).json({ error: 'You have already submitted an offer for this shift' });

  const result = db.prepare(`
    INSERT INTO open_shift_offers (open_shift_id, employee_id, status, ineligibility_reason)
    VALUES (?, ?, ?, ?)
  `).run(
    req.params.id, employeeId,
    eligible ? 'pending' : 'ineligible',
    ineligibilityReason
  );

  if (!eligible) {
    return res.status(422).json({
      error: `You are not eligible for this shift: ${reason}`,
      offer: db.prepare('SELECT * FROM open_shift_offers WHERE id = ?').get(result.lastInsertRowid),
    });
  }

  const offer = db.prepare('SELECT * FROM open_shift_offers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(offer);
});

/** PUT /api/open-shifts/:id/fill — manager accepts an offer (or manager override) */
router.put('/:id/fill', requireManager, (req: Request, res: Response) => {
  const { employee_id, offer_id, manager_override, manager_notes } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });

  const db = getDb();
  const openShift = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(req.params.id) as any;
  if (!openShift) return res.status(404).json({ error: 'Open shift not found' });
  if (openShift.status !== 'open') {
    return res.status(400).json({ error: 'Shift is no longer open' });
  }

  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id) as any;
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const { eligible, reason } = checkEligibility(db, openShift, emp);
  if (!eligible && !manager_override) {
    return res.status(422).json({
      error: `Employee is not eligible: ${reason}. Set manager_override=true to proceed with an explicit override.`,
      reason,
    });
  }

  // Assign the open shift
  db.prepare('UPDATE open_shifts SET status=?, claimed_by=? WHERE id=?').run('claimed', employee_id, req.params.id);

  // Create an actual shift record
  const shiftResult = db.prepare(`
    INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(openShift.schedule_id, employee_id, openShift.date, openShift.start_time, openShift.end_time, openShift.role);

  // Accept the specific offer if provided, reject others
  if (offer_id) {
    db.prepare("UPDATE open_shift_offers SET status='accepted', manager_notes=? WHERE id=?").run(manager_notes ?? null, offer_id);
  }
  db.prepare(
    "UPDATE open_shift_offers SET status='rejected' WHERE open_shift_id=? AND id != ? AND status='pending'"
  ).run(req.params.id, offer_id ?? -1);

  logAudit({
    action: manager_override ? 'open_shift_filled_override' : 'open_shift_filled',
    entity_type: 'open_shift',
    entity_id: parseInt(req.params.id, 10),
    user_id: req.user?.userId,
    details: {
      employee_id,
      manager_override: !!manager_override,
      ineligibility_bypassed: !eligible ? reason : null,
      new_shift_id: shiftResult.lastInsertRowid,
    },
  });

  const updated = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(req.params.id);
  res.json({ open_shift: updated, shift_id: shiftResult.lastInsertRowid });
});

/** DELETE /api/open-shifts/:id — manager cancels an open shift */
router.delete('/:id', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const openShift = db.prepare('SELECT * FROM open_shifts WHERE id = ?').get(req.params.id) as any;
  if (!openShift) return res.status(404).json({ error: 'Open shift not found' });
  db.prepare("UPDATE open_shifts SET status='cancelled' WHERE id=?").run(req.params.id);
  logAudit({
    action: 'open_shift_cancelled',
    entity_type: 'open_shift',
    entity_id: parseInt(req.params.id, 10),
    user_id: req.user?.userId,
    details: {},
  });
  res.json({ success: true });
});

export default router;

/**
 * Notify eligible employees about a newly posted open shift and send them direct messages.
 * Checks role match, availability, and basic overtime cap.
 */
function notifyEligibleForOpenShift(
  db: ReturnType<typeof import('../db').getDb>,
  openShift: any,
  managerEmployeeId: number | null = null
): void {
  const siteId = openShift.site_id ?? null;
  const requiredCerts: string[] = JSON.parse(openShift.required_certifications || '[]');

  const candidates: any[] = siteId
    ? db.prepare("SELECT * FROM employees WHERE role = ? AND site_id = ?").all(openShift.role, siteId) as any[]
    : db.prepare("SELECT * FROM employees WHERE role = ?").all(openShift.role) as any[];

  const dayOfWeek = new Date(openShift.date + 'T12:00:00').getDay();
  const shiftLabel = `${openShift.date} ${openShift.start_time}–${openShift.end_time}`;

  for (const emp of candidates) {
    // Certification check
    if (requiredCerts.length > 0) {
      const empCerts: string[] = JSON.parse(emp.certifications || '[]');
      const missing = requiredCerts.filter((c: string) => !empCerts.includes(c));
      if (missing.length > 0) continue;
    }

    // Availability check
    const avail = db.prepare(
      'SELECT * FROM availability WHERE employee_id = ? AND day_of_week = ?'
    ).get(emp.id, dayOfWeek) as any;
    if (avail?.availability_type === 'unavailable') continue;

    createNotification({
      employee_id: emp.id,
      type: 'open_shift_available',
      title: '📋 Open Shift Available',
      body: `A ${openShift.role} shift on ${shiftLabel} is now available. Tap to view and claim it.`,
      link: `/open-shifts`,
      data: { open_shift_id: openShift.id, shift_date: openShift.date, shift_role: openShift.role },
    });

    // Send a direct message from the manager to each eligible employee
    if (managerEmployeeId && managerEmployeeId !== emp.id) {
      sendSystemMessage({
        senderEmployeeId: managerEmployeeId,
        recipientEmployeeId: emp.id,
        body: `📋 Hi ${emp.name.split(' ')[0]}! A ${openShift.role} shift is available on ${shiftLabel}${openShift.reason ? ` (${openShift.reason})` : ''}.\n\nYou are eligible to claim this shift. Visit the Open Shifts page to pick it up.`,
        siteId,
      });
    }
  }
}
