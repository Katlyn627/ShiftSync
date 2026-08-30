import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();
const MAX_REASON_LENGTH = 1000;
const MAX_MANAGER_NOTES_LENGTH = 1000;

function parseNumericId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function daysBetweenUtc(a: Date, b: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((a.getTime() - b.getTime()) / dayMs);
}

function selectRequestById(db: ReturnType<typeof getDb>, id: number) {
  return db.prepare(`
    SELECT
      tor.id,
      tor.employee_id,
      e.name AS employee_name,
      tor.start_date,
      tor.end_date,
      tor.reason,
      tor.status,
      tor.manager_notes,
      tor.created_at
    FROM time_off_requests tor
    JOIN employees e ON e.id = tor.employee_id
    WHERE tor.id = ?
  `).get(id);
}

function validateStringField(value: unknown, fieldName: string, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  if (value.length > maxLength) {
    throw new Error(`${fieldName} is too long`);
  }
  return value;
}

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();

  if (req.user?.isManager) {
    if (req.user.siteId == null) return res.json([]);
    const rows = db.prepare(`
      SELECT
        tor.id,
        tor.employee_id,
        e.name AS employee_name,
        tor.start_date,
        tor.end_date,
        tor.reason,
        tor.status,
        tor.manager_notes,
        tor.created_at
      FROM time_off_requests tor
      JOIN employees e ON e.id = tor.employee_id
      WHERE e.site_id = ?
      ORDER BY tor.created_at DESC, tor.id DESC
    `).all(req.user.siteId);
    return res.json(rows);
  }

  if (!req.user?.employeeId) return res.json([]);
  const rows = db.prepare(`
    SELECT
      tor.id,
      tor.employee_id,
      e.name AS employee_name,
      tor.start_date,
      tor.end_date,
      tor.reason,
      tor.status,
      tor.manager_notes,
      tor.created_at
    FROM time_off_requests tor
    JOIN employees e ON e.id = tor.employee_id
    WHERE tor.employee_id = ?
    ORDER BY tor.created_at DESC, tor.id DESC
  `).all(req.user.employeeId);
  return res.json(rows);
});

router.post('/', requireAuth, (req: Request, res: Response) => {
  const employeeId = req.user?.employeeId;
  if (!employeeId) {
    return res.status(400).json({ error: 'Only linked employees can submit time-off requests' });
  }

  const { start_date, end_date } = req.body || {};
  let reason: string | null;

  try {
    reason = validateStringField((req.body || {}).reason, 'reason', MAX_REASON_LENGTH);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Invalid request' });
  }

  const startDate = parseDateOnly(start_date);
  const endDate = parseDateOnly(end_date);
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'start_date and end_date must be valid YYYY-MM-DD values' });
  }
  if (startDate.getTime() > endDate.getTime()) {
    return res.status(400).json({ error: 'start_date must be on or before end_date' });
  }

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const leadDays = daysBetweenUtc(startDate, todayUtc);
  if (leadDays < 14) {
    return res.status(400).json({ error: 'Time-off requests must be submitted at least 14 days in advance' });
  }

  const db = getDb();
  const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(employeeId) as { id: number } | undefined;
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const result = db.prepare(`
    INSERT INTO time_off_requests (employee_id, start_date, end_date, reason, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(employeeId, start_date, end_date, reason ?? null);

  const created = selectRequestById(db, Number(result.lastInsertRowid));
  return res.status(201).json(created);
});

router.put('/:id/approve', requireManager, (req: Request, res: Response) => {
  const id = parseNumericId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid request id' });

  let managerNotes: string | null;
  try {
    managerNotes = validateStringField((req.body || {}).manager_notes, 'manager_notes', MAX_MANAGER_NOTES_LENGTH);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Invalid request' });
  }

  const db = getDb();
  const existing = db.prepare(`
    SELECT tor.id, tor.status, e.site_id
    FROM time_off_requests tor
    JOIN employees e ON e.id = tor.employee_id
    WHERE tor.id = ?
  `).get(id) as { id: number; status: string; site_id: number | null } | undefined;

  if (!existing) return res.status(404).json({ error: 'Time-off request not found' });
  if (req.user?.siteId == null || existing.site_id !== req.user.siteId) {
    return res.status(403).json({ error: 'You can only manage requests for employees at your site' });
  }
  if (existing.status !== 'pending') {
    return res.status(400).json({ error: 'Time-off request is already resolved' });
  }

  db.prepare(`
    UPDATE time_off_requests
    SET status = 'approved', manager_notes = ?
    WHERE id = ?
  `).run(managerNotes ?? null, id);

  const updated = selectRequestById(db, id);
  return res.json(updated);
});

router.put('/:id/reject', requireManager, (req: Request, res: Response) => {
  const id = parseNumericId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid request id' });

  let managerNotes: string | null;
  try {
    managerNotes = validateStringField((req.body || {}).manager_notes, 'manager_notes', MAX_MANAGER_NOTES_LENGTH);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Invalid request' });
  }

  const db = getDb();
  const existing = db.prepare(`
    SELECT tor.id, tor.status, e.site_id
    FROM time_off_requests tor
    JOIN employees e ON e.id = tor.employee_id
    WHERE tor.id = ?
  `).get(id) as { id: number; status: string; site_id: number | null } | undefined;

  if (!existing) return res.status(404).json({ error: 'Time-off request not found' });
  if (req.user?.siteId == null || existing.site_id !== req.user.siteId) {
    return res.status(403).json({ error: 'You can only manage requests for employees at your site' });
  }
  if (existing.status !== 'pending') {
    return res.status(400).json({ error: 'Time-off request is already resolved' });
  }

  db.prepare(`
    UPDATE time_off_requests
    SET status = 'rejected', manager_notes = ?
    WHERE id = ?
  `).run(managerNotes ?? null, id);

  const updated = selectRequestById(db, id);
  return res.json(updated);
});

router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const id = parseNumericId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid request id' });

  const db = getDb();
  const existing = db.prepare(`
    SELECT tor.id, tor.employee_id, tor.status, e.site_id
    FROM time_off_requests tor
    JOIN employees e ON e.id = tor.employee_id
    WHERE tor.id = ?
  `).get(id) as { id: number; employee_id: number; status: string; site_id: number | null } | undefined;

  if (!existing) return res.status(404).json({ error: 'Time-off request not found' });

  if (req.user?.isManager) {
    if (req.user.siteId == null || existing.site_id !== req.user.siteId) {
      return res.status(403).json({ error: 'You can only manage requests for employees at your site' });
    }
    if (existing.status === 'pending') {
      return res.status(400).json({ error: 'Managers may only delete resolved requests' });
    }
    db.prepare('DELETE FROM time_off_requests WHERE id = ?').run(id);
    return res.json({ success: true });
  }

  if (!req.user?.employeeId || req.user.employeeId !== existing.employee_id) {
    return res.status(403).json({ error: 'You can only delete your own time-off requests' });
  }
  if (existing.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending requests can be cancelled' });
  }

  db.prepare('DELETE FROM time_off_requests WHERE id = ?').run(id);
  return res.json({ success: true });
});

export default router;
