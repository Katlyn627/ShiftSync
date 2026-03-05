import { Router } from 'express';
import Employee from '../models/Employee.js';
import Availability from '../models/Availability.js';
import Shift from '../models/Shift.js';
import { requireAuth, requireManager } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const employees = await Employee.find().sort({ name: 1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireManager, async (req, res) => {
  const { name, role, hourly_rate, weekly_hours_max, email, phone } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  try {
    const employee = await Employee.create({
      name, role,
      hourly_rate: hourly_rate ?? 15.0,
      weekly_hours_max: weekly_hours_max ?? 40,
      email: email ?? '',
      phone: phone ?? '',
    });
    res.status(201).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await Employee.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });

    const isManager = req.user?.isManager;
    const isSelf = req.user?.employeeId === req.params.id;

    if (!isManager && !isSelf) {
      return res.status(403).json({ error: 'You can only update your own profile' });
    }

    const { name, role, hourly_rate, weekly_hours_max, email, phone, photo_url } = req.body;

    if (isManager) {
      if (name !== undefined) existing.name = name;
      if (role !== undefined) existing.role = role;
      if (hourly_rate !== undefined) existing.hourly_rate = hourly_rate;
      if (weekly_hours_max !== undefined) existing.weekly_hours_max = weekly_hours_max;
      if (email !== undefined) existing.email = email;
      if (phone !== undefined) existing.phone = phone;
      if (photo_url !== undefined) existing.photo_url = photo_url;
    } else {
      if (weekly_hours_max !== undefined) existing.weekly_hours_max = weekly_hours_max;
      if (email !== undefined) existing.email = email;
      if (phone !== undefined) existing.phone = phone;
      if (photo_url !== undefined) existing.photo_url = photo_url;
    }

    await existing.save();
    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireManager, async (req, res) => {
  try {
    const result = await Employee.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const scheduleId = req.query.schedule_id;
    if (!scheduleId) return res.status(400).json({ error: 'schedule_id is required' });

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const shifts = await Shift.find({ employee_id: employeeId, schedule_id: scheduleId });

    function parseMinutes(time) {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    }
    function shiftHrs(start, end) {
      const startMin = parseMinutes(start);
      let endMin = parseMinutes(end);
      if (endMin < startMin) endMin += 24 * 60;
      return (endMin - startMin) / 60;
    }

    const total_hours = shifts.reduce((sum, s) => sum + shiftHrs(s.start_time, s.end_time), 0);
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/availability', requireAuth, async (req, res) => {
  try {
    const availability = await Availability.find({ employee_id: req.params.id }).sort({ day_of_week: 1 });
    res.json(availability);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/availability', requireAuth, async (req, res) => {
  const employeeId = req.params.id;
  const isManager = req.user?.isManager;
  const isSelf = req.user?.employeeId === employeeId;
  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'You can only update your own availability' });
  }

  const { day_of_week, start_time, end_time } = req.body;
  if (day_of_week === undefined || !start_time || !end_time) {
    return res.status(400).json({ error: 'day_of_week, start_time, end_time are required' });
  }

  try {
    const avail = await Availability.findOneAndUpdate(
      { employee_id: employeeId, day_of_week },
      { employee_id: employeeId, day_of_week, start_time, end_time },
      { upsert: true, new: true }
    );
    res.status(201).json(avail);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/availability/:day', requireAuth, async (req, res) => {
  const employeeId = req.params.id;
  const isManager = req.user?.isManager;
  const isSelf = req.user?.employeeId === employeeId;
  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'You can only update your own availability' });
  }

  try {
    const result = await Availability.findOneAndDelete({
      employee_id: employeeId,
      day_of_week: parseInt(req.params.day),
    });
    if (!result) return res.status(404).json({ error: 'Availability entry not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
