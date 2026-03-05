import { Router } from 'express';
import ShiftSwap from '../models/ShiftSwap.js';
import Shift from '../models/Shift.js';
import Employee from '../models/Employee.js';
import Schedule from '../models/Schedule.js';
import { requireManager } from '../middleware/auth.js';

const router = Router();

function parseMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

router.get('/', async (_req, res) => {
  try {
    const swaps = await ShiftSwap.find()
      .populate('requester_id', 'name')
      .populate('target_id', 'name')
      .populate('shift_id')
      .sort({ created_at: -1 });

    const result = swaps.map(sw => {
      const obj = sw.toJSON();
      obj.requester_name = sw.requester_id?.name ?? null;
      obj.target_name = sw.target_id?.name ?? null;
      obj.shift_date = sw.shift_id?.date ?? null;
      obj.start_time = sw.shift_id?.start_time ?? null;
      obj.end_time = sw.shift_id?.end_time ?? null;
      obj.shift_role = sw.shift_id?.role ?? null;
      obj.requester_id = sw.requester_id?._id.toString() ?? null;
      obj.target_id = sw.target_id?._id.toString() ?? null;
      obj.shift_id = sw.shift_id?._id.toString() ?? null;
      return obj;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { shift_id, requester_id, target_id, reason } = req.body;
  if (!shift_id || !requester_id) {
    return res.status(400).json({ error: 'shift_id and requester_id are required' });
  }

  try {
    const shift = await Shift.findById(shift_id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.employee_id?.toString() !== requester_id.toString()) {
      return res.status(403).json({ error: 'Requester does not own this shift' });
    }

    if (target_id) {
      const target = await Employee.findById(target_id);
      if (!target) return res.status(404).json({ error: 'Target employee not found' });
      if (target.role !== shift.role && target.role !== 'Manager') {
        return res.status(400).json({ error: `Target role mismatch: shift requires ${shift.role}, target is ${target.role}` });
      }

      function calcHrs(start, end) {
        const s = parseMinutes(start);
        let e = parseMinutes(end);
        if (e < s) e += 24 * 60;
        return (e - s) / 60;
      }
      const schedule = await Schedule.findById(shift.schedule_id);
      const weekStart = schedule.week_start;
      const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      const existingShifts = await Shift.find({
        employee_id: target_id,
        date: { $gte: weekStart, $lt: weekEnd },
        status: { $ne: 'cancelled' },
      });
      const totalHours = existingShifts.reduce((sum, s) => sum + calcHrs(s.start_time, s.end_time), 0);
      const shiftHrs = calcHrs(shift.start_time, shift.end_time);
      if (totalHours + shiftHrs > target.weekly_hours_max) {
        return res.status(400).json({ error: `Swap would put target employee over their weekly hour limit (${target.weekly_hours_max}h)` });
      }
    }

    const swap = await ShiftSwap.create({
      shift_id,
      requester_id,
      target_id: target_id ?? null,
      reason: reason ?? null,
    });
    res.status(201).json(swap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/approve', requireManager, async (req, res) => {
  const { manager_notes } = req.body;
  try {
    const swap = await ShiftSwap.findById(req.params.id);
    if (!swap) return res.status(404).json({ error: 'Swap not found' });
    if (swap.status !== 'pending') return res.status(400).json({ error: 'Swap is not pending' });

    swap.status = 'approved';
    swap.manager_notes = manager_notes ?? null;
    await swap.save();

    if (swap.target_id) {
      await Shift.findByIdAndUpdate(swap.shift_id, {
        employee_id: swap.target_id,
        status: 'swapped',
      });
    }

    res.json(swap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/reject', requireManager, async (req, res) => {
  const { manager_notes } = req.body;
  try {
    const swap = await ShiftSwap.findById(req.params.id);
    if (!swap) return res.status(404).json({ error: 'Swap not found' });
    if (swap.status !== 'pending') return res.status(400).json({ error: 'Swap is not pending' });

    swap.status = 'rejected';
    swap.manager_notes = manager_notes ?? null;
    await swap.save();
    res.json(swap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
