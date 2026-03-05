import { Router } from 'express';
import Shift from '../models/Shift.js';
import Employee from '../models/Employee.js';
import Schedule from '../models/Schedule.js';
import { requireAuth, requireManager } from '../middleware/auth.js';

const router = Router();

function parseMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function calcShiftHours(start, end) {
  const s = parseMinutes(start);
  let e = parseMinutes(end);
  if (e <= s) e += 24 * 60;
  return (e - s) / 60;
}

router.put('/:id', requireManager, async (req, res) => {
  const { start_time, end_time, status, employee_id } = req.body;
  try {
    const existing = await Shift.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Shift not found' });

    if (employee_id !== undefined && employee_id !== existing.employee_id?.toString()) {
      const employee = await Employee.findById(employee_id);
      if (!employee) return res.status(404).json({ error: 'Employee not found' });

      const newStart = start_time ?? existing.start_time;
      const newEnd = end_time ?? existing.end_time;
      const shiftHrs = calcShiftHours(newStart, newEnd);

      const otherShifts = await Shift.find({
        schedule_id: existing.schedule_id,
        employee_id,
        _id: { $ne: req.params.id },
        status: { $ne: 'cancelled' },
      });

      const currentHours = otherShifts.reduce((sum, s) => sum + calcShiftHours(s.start_time, s.end_time), 0);

      if (currentHours + shiftHrs > employee.weekly_hours_max) {
        return res.status(400).json({
          error: `${employee.name} would exceed their weekly hours limit of ${employee.weekly_hours_max}h`,
        });
      }
    }

    if (start_time) existing.start_time = start_time;
    if (end_time) existing.end_time = end_time;
    if (status) existing.status = status;
    if (employee_id !== undefined) existing.employee_id = employee_id;
    await existing.save();

    const updated = await Shift.findById(req.params.id).populate('employee_id', 'name role hourly_rate');
    const obj = updated.toJSON();
    if (updated.employee_id) {
      obj.employee_name = updated.employee_id.name;
      obj.employee_role = updated.employee_id.role;
      obj.hourly_rate = updated.employee_id.hourly_rate;
      obj.employee_id = updated.employee_id._id.toString();
    }
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireManager, async (req, res) => {
  const { schedule_id, employee_id, date, start_time, end_time, role } = req.body;
  if (!schedule_id || !date || !start_time || !end_time || !role) {
    return res.status(400).json({ error: 'schedule_id, date, start_time, end_time, and role are required' });
  }

  try {
    const schedule = await Schedule.findById(schedule_id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    if (employee_id) {
      const employee = await Employee.findById(employee_id);
      if (!employee) return res.status(404).json({ error: 'Employee not found' });

      const shiftHrs = calcShiftHours(start_time, end_time);
      const existingShifts = await Shift.find({
        schedule_id,
        employee_id,
        status: { $ne: 'cancelled' },
      });

      const currentHours = existingShifts.reduce((sum, s) => sum + calcShiftHours(s.start_time, s.end_time), 0);
      if (currentHours + shiftHrs > employee.weekly_hours_max) {
        return res.status(400).json({
          error: `${employee.name} would exceed their weekly hours limit of ${employee.weekly_hours_max}h`,
        });
      }
    }

    const shift = await Shift.create({
      schedule_id,
      employee_id: employee_id ?? null,
      date,
      start_time,
      end_time,
      role,
      status: 'scheduled',
    });

    if (employee_id) {
      const created = await Shift.findById(shift._id).populate('employee_id', 'name role hourly_rate');
      const obj = created.toJSON();
      obj.employee_name = created.employee_id.name;
      obj.employee_role = created.employee_id.role;
      obj.hourly_rate = created.employee_id.hourly_rate;
      obj.employee_id = created.employee_id._id.toString();
      return res.status(201).json(obj);
    }
    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await Shift.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Shift not found' });
    if (req.user?.isManager) {
      await Shift.findByIdAndDelete(req.params.id);
    } else {
      existing.status = 'cancelled';
      await existing.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
