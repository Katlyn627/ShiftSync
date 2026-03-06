import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const siteId = req.user?.siteId;
  const employees = siteId
    ? db.prepare('SELECT * FROM employees WHERE site_id = ? ORDER BY name').all(siteId)
    : db.prepare('SELECT * FROM employees ORDER BY name').all();
  res.json(employees);
});

router.post('/', requireManager, (req, res) => {
  const { name, role, hourly_rate, weekly_hours_max, email, phone, pay_type, certifications, is_minor, union_member } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const result = db.prepare(
    'INSERT INTO employees (name, role, hourly_rate, weekly_hours_max, email, phone, pay_type, certifications, is_minor, union_member, site_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    name,
    role,
    hourly_rate ?? 15.0,
    weekly_hours_max ?? 40,
    email ?? '',
    phone ?? '',
    pay_type ?? 'hourly',
    certifications ? JSON.stringify(certifications) : '[]',
    is_minor ? 1 : 0,
    union_member ? 1 : 0,
    siteId
  );
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(employee);
});

// Allow managers to update any employee; allow employees to update their own profile fields
router.put('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Employee not found' });

  const isManager = req.user?.isManager;
  const isSelf = req.user?.employeeId === parseInt(req.params.id);

  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'You can only update your own profile' });
  }

  const { name, role, hourly_rate, weekly_hours_max, email, phone, photo_url, pay_type, certifications, is_minor, union_member } = req.body;

  if (isManager) {
    // Managers can update everything
    db.prepare(
      'UPDATE employees SET name=?, role=?, hourly_rate=?, weekly_hours_max=?, email=?, phone=?, photo_url=?, pay_type=?, certifications=?, is_minor=?, union_member=? WHERE id=?'
    ).run(
      name ?? existing.name,
      role ?? existing.role,
      hourly_rate ?? existing.hourly_rate,
      weekly_hours_max ?? existing.weekly_hours_max,
      email !== undefined ? email : (existing.email ?? ''),
      phone !== undefined ? phone : (existing.phone ?? ''),
      photo_url !== undefined ? photo_url : (existing.photo_url ?? null),
      pay_type ?? existing.pay_type ?? 'hourly',
      certifications !== undefined ? JSON.stringify(certifications) : (existing.certifications ?? '[]'),
      is_minor !== undefined ? (is_minor ? 1 : 0) : (existing.is_minor ?? 0),
      union_member !== undefined ? (union_member ? 1 : 0) : (existing.union_member ?? 0),
      req.params.id
    );
  } else {
    // Employees can only update their own contact info, availability preferences, and photo
    db.prepare(
      'UPDATE employees SET weekly_hours_max=?, email=?, phone=?, photo_url=? WHERE id=?'
    ).run(
      weekly_hours_max ?? existing.weekly_hours_max,
      email !== undefined ? email : (existing.email ?? ''),
      phone !== undefined ? phone : (existing.phone ?? ''),
      photo_url !== undefined ? photo_url : (existing.photo_url ?? null),
      req.params.id
    );
  }

  const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', requireManager, (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json({ success: true });
});

// Availability
router.get('/:id/availability', requireAuth, (req, res) => {
  const db = getDb();
  const availability = db.prepare('SELECT * FROM availability WHERE employee_id = ? ORDER BY day_of_week').all(req.params.id);
  res.json(availability);
});

router.post('/:id/availability', requireAuth, (req, res) => {
  const db = getDb();
  const employeeId = parseInt(req.params.id);
  const isManager = req.user?.isManager;
  const isSelf = req.user?.employeeId === employeeId;
  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'You can only update your own availability' });
  }

  const { day_of_week, start_time, end_time, availability_type } = req.body;
  if (day_of_week === undefined) {
    return res.status(400).json({ error: 'day_of_week is required' });
  }

  const type = availability_type ?? 'specific';

  // For 'open', store full-day times; for 'unavailable', store sentinel times;
  // for 'specific', require explicit start/end times.
  let resolvedStart = start_time;
  let resolvedEnd = end_time;
  if (type === 'open') {
    resolvedStart = '00:00';
    resolvedEnd = '23:59';
  } else if (type === 'unavailable') {
    resolvedStart = '00:00';
    resolvedEnd = '00:00';
  } else {
    if (!start_time || !end_time) {
      return res.status(400).json({ error: 'start_time and end_time are required for specific availability' });
    }
  }

  db.prepare(
    'INSERT OR REPLACE INTO availability (employee_id, day_of_week, start_time, end_time, availability_type) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, day_of_week, resolvedStart, resolvedEnd, type);
  const avail = db.prepare('SELECT * FROM availability WHERE employee_id = ? AND day_of_week = ?').get(req.params.id, day_of_week);
  res.status(201).json(avail);
});

router.delete('/:id/availability/:day', requireAuth, (req, res) => {
  const db = getDb();
  const employeeId = parseInt(req.params.id);
  const isManager = req.user?.isManager;
  const isSelf = req.user?.employeeId === employeeId;
  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'You can only update your own availability' });
  }
  const result = db.prepare(
    'DELETE FROM availability WHERE employee_id = ? AND day_of_week = ?'
  ).run(employeeId, req.params.day);
  if (result.changes === 0) return res.status(404).json({ error: 'Availability entry not found' });
  res.json({ success: true });
});

export default router;