import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (_req, res) => {
  const db = getDb();
  const employees = db.prepare('SELECT * FROM employees ORDER BY name').all();
  res.json(employees);
});

router.post('/', requireManager, (req, res) => {
  const { name, role, hourly_rate, weekly_hours_max, email, phone } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO employees (name, role, hourly_rate, weekly_hours_max, email, phone) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, role, hourly_rate ?? 15.0, weekly_hours_max ?? 40, email ?? '', phone ?? '');
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

  const { name, role, hourly_rate, weekly_hours_max, email, phone, photo_url } = req.body;

  if (isManager) {
    // Managers can update everything
    db.prepare(
      'UPDATE employees SET name=?, role=?, hourly_rate=?, weekly_hours_max=?, email=?, phone=?, photo_url=? WHERE id=?'
    ).run(
      name ?? existing.name,
      role ?? existing.role,
      hourly_rate ?? existing.hourly_rate,
      weekly_hours_max ?? existing.weekly_hours_max,
      email !== undefined ? email : (existing.email ?? ''),
      phone !== undefined ? phone : (existing.phone ?? ''),
      photo_url !== undefined ? photo_url : (existing.photo_url ?? null),
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

// Stats for a specific employee within a schedule
router.get('/:id/stats', requireAuth, (req, res) => {
  const db = getDb();
  const employeeId = parseInt(req.params.id);
  const scheduleId = parseInt(req.query.schedule_id as string);

  if (!scheduleId) return res.status(400).json({ error: 'schedule_id is required' });

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as any;
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const shifts = db.prepare(
    'SELECT * FROM shifts WHERE employee_id = ? AND schedule_id = ?'
  ).all(employeeId, scheduleId) as any[];

  function parseMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function shiftHours(start: string, end: string): number {
    const startMin = parseMinutes(start);
    let endMin = parseMinutes(end);
    if (endMin < startMin) endMin += 24 * 60;
    return (endMin - startMin) / 60;
  }

  const total_hours = shifts.reduce((sum: number, s: any) => sum + shiftHours(s.start_time, s.end_time), 0);
  const labor_cost = total_hours * employee.hourly_rate;

  res.json({
    employee_id: employeeId,
    schedule_id: scheduleId,
    shifts_count: shifts.length,
    total_hours,
    labor_cost,
    overtime_hours: Math.max(0, total_hours - 40),
    avg_hours_per_shift: shifts.length > 0 ? total_hours / shifts.length : 0,
  });
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

  const { day_of_week, start_time, end_time } = req.body;
  if (day_of_week === undefined || !start_time || !end_time) {
    return res.status(400).json({ error: 'day_of_week, start_time, end_time are required' });
  }
  db.prepare(
    'INSERT OR REPLACE INTO availability (employee_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, day_of_week, start_time, end_time);
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