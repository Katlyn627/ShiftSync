import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/config
// Returns role-scoped configured data for the current user.
// Manager: all employees + availability + schedules + shifts + swaps + forecasts
// Employee: own profile + own availability + own shifts + relevant swaps
router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const user = req.user!;

  if (user.role === 'manager') {
    const employees = db.prepare('SELECT * FROM employees ORDER BY name').all();
    const availability = db.prepare('SELECT * FROM availability ORDER BY employee_id, day_of_week').all();
    const schedules = db.prepare('SELECT * FROM schedules ORDER BY week_start DESC').all();
    const shifts = db.prepare(
      'SELECT s.*, e.name as employee_name FROM shifts s JOIN employees e ON s.employee_id=e.id ORDER BY s.date, s.start_time'
    ).all();
    const swaps = db.prepare(`
      SELECT sw.*, e1.name as requester_name, e2.name as target_name,
        s.date as shift_date, s.start_time, s.end_time, s.role as shift_role
      FROM shift_swaps sw
      JOIN employees e1 ON sw.requester_id=e1.id
      LEFT JOIN employees e2 ON sw.target_id=e2.id
      JOIN shifts s ON sw.shift_id=s.id
      ORDER BY sw.created_at DESC
    `).all();
    const forecasts = db.prepare('SELECT * FROM forecasts ORDER BY date').all();

    res.json({ role: 'manager', employees, availability, schedules, shifts, swaps, forecasts });
    return;
  }

  // Employee-scoped data
  const employeeId = user.employeeId;
  if (!employeeId) {
    res.json({ role: 'employee', employee: null, availability: [], shifts: [], swaps: [] });
    return;
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id=?').get(employeeId);
  const availability = db.prepare('SELECT * FROM availability WHERE employee_id=? ORDER BY day_of_week').all(employeeId);
  const shifts = db.prepare(
    'SELECT s.*, sc.week_start FROM shifts s JOIN schedules sc ON s.schedule_id=sc.id WHERE s.employee_id=? ORDER BY s.date, s.start_time'
  ).all(employeeId);
  const swaps = db.prepare(`
    SELECT sw.*, e1.name as requester_name, e2.name as target_name,
      s.date as shift_date, s.start_time, s.end_time, s.role as shift_role
    FROM shift_swaps sw
    JOIN employees e1 ON sw.requester_id=e1.id
    LEFT JOIN employees e2 ON sw.target_id=e2.id
    JOIN shifts s ON sw.shift_id=s.id
    WHERE sw.requester_id=? OR sw.target_id=?
    ORDER BY sw.created_at DESC
  `).all(employeeId, employeeId);

  res.json({ role: 'employee', employee, availability, shifts, swaps });
});

export default router;
