import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { calculateBurnoutRisks, calculateTurnoverRisks } from '../burnout';
import { getLaborCostSummary } from '../laborCost';

const router = Router();

router.get('/', requireAuth, (_req, res) => {
  const db = getDb();
  const employees = db.prepare('SELECT * FROM employees ORDER BY name').all();
  res.json(employees);
});

router.post('/', requireManager, (req, res) => {
  const { name, role, hourly_rate, weekly_hours_max } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO employees (name, role, hourly_rate, weekly_hours_max) VALUES (?, ?, ?, ?)'
  ).run(name, role, hourly_rate ?? 15.0, weekly_hours_max ?? 40);
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(employee);
});

router.put('/:id', requireManager, (req, res) => {
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

router.delete('/:id', requireManager, (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json({ success: true });
});

// Employee stats for a specific schedule
router.get('/:id/stats', requireManager, (req, res) => {
  const db = getDb();
  const employeeId = parseInt(req.params.id);
  const scheduleId = parseInt(req.query.schedule_id as string);

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as any;
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  if (!scheduleId || isNaN(scheduleId)) {
    return res.status(400).json({ error: 'schedule_id query parameter is required' });
  }

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  const shifts = db.prepare(
    "SELECT * FROM shifts WHERE schedule_id = ? AND employee_id = ? AND status != 'cancelled' ORDER BY date, start_time"
  ).all(scheduleId, employeeId) as any[];

  // Compute weekly hours and labor cost
  const weeklyHours = shifts.reduce((sum: number, s: any) => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    const startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin < startMin) endMin += 24 * 60;
    return sum + (endMin - startMin) / 60;
  }, 0);
  const laborCost = weeklyHours * employee.hourly_rate;
  const laborPctOfBudget = schedule.labor_budget > 0
    ? (laborCost / schedule.labor_budget) * 100
    : 0;

  // Get burnout and turnover risks for this schedule and filter for this employee
  let burnout = null;
  let turnover = null;
  try {
    const burnoutRisks = calculateBurnoutRisks(scheduleId);
    burnout = burnoutRisks.find(r => r.employee_id === employeeId) ?? null;
  } catch (_) {}
  try {
    const turnoverRisks = calculateTurnoverRisks(scheduleId);
    turnover = turnoverRisks.find(r => r.employee_id === employeeId) ?? null;
  } catch (_) {}

  res.json({
    employee,
    schedule_id: scheduleId,
    weekly_hours: Math.round(weeklyHours * 10) / 10,
    labor_cost: Math.round(laborCost * 100) / 100,
    labor_pct_of_budget: Math.round(laborPctOfBudget * 10) / 10,
    shifts,
    burnout,
    turnover,
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