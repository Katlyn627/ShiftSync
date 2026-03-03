import { Router } from 'express';
import { getDb } from '../db';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const employees = db.prepare('SELECT * FROM employees ORDER BY name').all();
  res.json(employees);
});

router.post('/', (req, res) => {
  const { name, role, hourly_rate, weekly_hours_max } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO employees (name, role, hourly_rate, weekly_hours_max) VALUES (?, ?, ?, ?)'
  ).run(name, role, hourly_rate ?? 15.0, weekly_hours_max ?? 40);
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(employee);
});

router.put('/:id', (req, res) => {
  const { name, role, hourly_rate, weekly_hours_max } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  db.prepare(
    'UPDATE employees SET name=?, role=?, hourly_rate=?, weekly_hours_max=? WHERE id=?'
  ).run(
    name ?? existing.name,
    role ?? existing.role,
    hourly_rate ?? existing.hourly_rate,
    weekly_hours_max ?? existing.weekly_hours_max,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json({ success: true });
});

// Availability
router.get('/:id/availability', (req, res) => {
  const db = getDb();
  const availability = db.prepare('SELECT * FROM availability WHERE employee_id = ? ORDER BY day_of_week').all(req.params.id);
  res.json(availability);
});

router.post('/:id/availability', (req, res) => {
  const db = getDb();
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

export default router;