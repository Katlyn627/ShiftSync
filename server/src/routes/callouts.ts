/**
 * /api/callouts — Call-Out Event Workflow
 *
 * Tracks employee absences/no-shows and provides automated replacement
 * suggestions. When a callout is reported, the system can automatically
 * create an open shift in the marketplace. Manager overrides are
 * explicitly recorded in the audit trail.
 */
import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { logAudit } from './audit';

const router = Router();

/** GET /api/callouts — list callout events */
router.get('/', requireManager, (req, res) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const { status, date_from, date_to } = req.query as Record<string, string | undefined>;

  const conditions: string[] = ['1=1'];
  const params: (string | number | null)[] = [];

  if (siteId !== null) { conditions.push('e.site_id = ?'); params.push(siteId); }
  if (date_from) { conditions.push('ce.callout_time >= ?'); params.push(date_from); }
  if (date_to)   { conditions.push('ce.callout_time <= ?'); params.push(date_to); }
  if (status)    { conditions.push('ce.replacement_status = ?'); params.push(status); }

  const rows = db.prepare(`
    SELECT ce.*,
      e.name as employee_name, e.role as employee_role,
      e2.name as replacement_name,
      s.date as shift_date, s.start_time, s.end_time, s.role as shift_role
    FROM callout_events ce
    JOIN employees e ON ce.employee_id = e.id
    LEFT JOIN employees e2 ON ce.replacement_employee_id = e2.id
    LEFT JOIN shifts s ON ce.shift_id = s.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ce.callout_time DESC
  `).all(...params);
  res.json(rows);
});

/** POST /api/callouts — report a callout/absence */
router.post('/', requireAuth, (req, res) => {
  const { shift_id, employee_id, reason, manager_notes, auto_open_shift } = req.body;
  const reportingEmployeeId = employee_id ?? req.user?.employeeId;
  if (!reportingEmployeeId) return res.status(400).json({ error: 'employee_id is required' });

  const db = getDb();

  // Verify employee exists
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(reportingEmployeeId) as any;
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  // Verify shift belongs to employee if provided
  if (shift_id) {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id) as any;
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.employee_id !== reportingEmployeeId && !req.user?.isManager) {
      return res.status(403).json({ error: 'You can only report callouts for your own shifts' });
    }
    // Mark shift as cancelled
    db.prepare("UPDATE shifts SET status='cancelled' WHERE id=?").run(shift_id);
  }

  const result = db.prepare(`
    INSERT INTO callout_events (shift_id, employee_id, reason, manager_notes)
    VALUES (?, ?, ?, ?)
  `).run(shift_id ?? null, reportingEmployeeId, reason ?? null, manager_notes ?? null);

  const calloutId = result.lastInsertRowid as number;
  let openShiftId: number | null = null;

  // Auto-create open shift if flag is set (or if manager requests)
  if (auto_open_shift && shift_id) {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id) as any;
    if (shift) {
      const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(shift.schedule_id) as any;
      const osResult = db.prepare(`
        INSERT INTO open_shifts (schedule_id, site_id, date, start_time, end_time, role, reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'callout', ?)
      `).run(
        shift.schedule_id, schedule?.site_id ?? null,
        shift.date, shift.start_time, shift.end_time, shift.role,
        req.user?.userId ?? null
      );
      openShiftId = osResult.lastInsertRowid as number;
      db.prepare('UPDATE callout_events SET open_shift_id=?, replacement_status=? WHERE id=?')
        .run(openShiftId, 'searching', calloutId);
    }
  }

  logAudit({
    action: 'callout_reported',
    entity_type: 'callout',
    entity_id: calloutId,
    user_id: req.user?.userId,
    details: { employee_id: reportingEmployeeId, shift_id, reason, auto_open_shift: !!auto_open_shift },
  });

  const callout = db.prepare('SELECT * FROM callout_events WHERE id = ?').get(calloutId);
  res.status(201).json({ callout, open_shift_id: openShiftId });
});

/** GET /api/callouts/:id/eligible-replacements — find eligible replacements */
router.get('/:id/eligible-replacements', requireManager, (req, res) => {
  const db = getDb();
  const callout = db.prepare('SELECT * FROM callout_events WHERE id = ?').get(req.params.id) as any;
  if (!callout) return res.status(404).json({ error: 'Callout not found' });

  if (!callout.shift_id) {
    return res.status(400).json({ error: 'Callout has no associated shift to find replacements for' });
  }

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(callout.shift_id) as any;
  if (!shift) return res.status(404).json({ error: 'Associated shift not found' });

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(shift.schedule_id) as any;
  const siteId = schedule?.site_id ?? null;

  // Get all employees of matching role at this site
  const candidates = siteId
    ? db.prepare("SELECT * FROM employees WHERE role = ? AND site_id = ?").all(shift.role, siteId) as any[]
    : db.prepare("SELECT * FROM employees WHERE role = ?").all(shift.role) as any[];

  function toMinutes(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
  function shiftHoursLocal(start: string, end: string): number {
    let s = toMinutes(start); let e = toMinutes(end);
    if (e <= s) e += 24 * 60; return (e - s) / 60;
  }

  const results = candidates.map((emp: any) => {
    const dayOfWeek = new Date(shift.date + 'T12:00:00').getDay();
    const avail = db.prepare('SELECT * FROM availability WHERE employee_id = ? AND day_of_week = ?').get(emp.id, dayOfWeek) as any;
    if (avail?.availability_type === 'unavailable') {
      return { employee: emp, eligible: false, reason: 'unavailable' };
    }

    // Weekly hours check
    const weekEnd = new Date(new Date(schedule.week_start + 'T00:00:00').getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const weekShifts = db.prepare("SELECT * FROM shifts WHERE employee_id = ? AND date >= ? AND date < ? AND status != 'cancelled'").all(emp.id, schedule.week_start, weekEnd) as any[];
    const totalHours = weekShifts.reduce((sum: number, s: any) => sum + shiftHoursLocal(s.start_time, s.end_time), 0);
    const newHours = shiftHoursLocal(shift.start_time, shift.end_time);
    if (totalHours + newHours > emp.weekly_hours_max) {
      return { employee: emp, eligible: false, reason: `overtime_cap: ${totalHours.toFixed(1)}h + ${newHours.toFixed(1)}h > ${emp.weekly_hours_max}h limit` };
    }

    return { employee: emp, eligible: true, reason: null, current_weekly_hours: totalHours };
  });

  res.json({ shift, candidates: results.sort((a, b) => (b.eligible ? 1 : 0) - (a.eligible ? 1 : 0)) });
});

/** PUT /api/callouts/:id/resolve — manager resolves a callout (found/not found) */
router.put('/:id/resolve', requireManager, (req, res) => {
  const { replacement_employee_id, replacement_status, manager_notes, manager_override } = req.body;
  const db = getDb();
  const callout = db.prepare('SELECT * FROM callout_events WHERE id = ?').get(req.params.id) as any;
  if (!callout) return res.status(404).json({ error: 'Callout not found' });

  const status = replacement_status ?? (replacement_employee_id ? 'found' : 'not_found');
  db.prepare(`
    UPDATE callout_events
    SET replacement_employee_id=?, replacement_status=?, manager_override=?, manager_notes=?
    WHERE id=?
  `).run(
    replacement_employee_id ?? null,
    status,
    manager_override ? 1 : 0,
    manager_notes ?? null,
    req.params.id
  );

  // Close the associated open shift if resolved
  if (callout.open_shift_id && replacement_employee_id) {
    db.prepare("UPDATE open_shifts SET status='claimed', claimed_by=? WHERE id=?")
      .run(replacement_employee_id, callout.open_shift_id);
  }

  logAudit({
    action: 'callout_resolved',
    entity_type: 'callout',
    entity_id: parseInt(req.params.id, 10),
    user_id: req.user?.userId,
    details: { replacement_employee_id, replacement_status: status, manager_override: !!manager_override },
  });

  const updated = db.prepare('SELECT * FROM callout_events WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
