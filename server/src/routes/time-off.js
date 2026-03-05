import { Router } from 'express';
import TimeOffRequest from '../models/TimeOffRequest.js';
import Employee from '../models/Employee.js';
import { requireAuth, requireManager } from '../middleware/auth.js';

const router = Router();

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function twoWeeksFromNow() {
  return new Date(Date.now() + TWO_WEEKS_MS).toISOString().slice(0, 10);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    let query;
    if (req.user?.isManager) {
      query = TimeOffRequest.find().populate('employee_id', 'name');
    } else {
      const empId = req.user?.employeeId;
      if (!empId) return res.status(400).json({ error: 'No employee record linked to your account' });
      query = TimeOffRequest.find({ employee_id: empId }).populate('employee_id', 'name');
    }
    const rows = await query.sort({ created_at: -1 });
    const result = rows.map(r => {
      const obj = r.toJSON();
      obj.employee_name = r.employee_id?.name ?? null;
      obj.employee_id = r.employee_id?._id.toString() ?? null;
      return obj;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const empId = req.user?.employeeId;
  if (!empId && !req.user?.isManager) {
    return res.status(400).json({ error: 'No employee record linked to your account' });
  }
  const targetEmpId = req.user?.isManager && req.body.employee_id ? req.body.employee_id : empId;
  if (!targetEmpId) return res.status(400).json({ error: 'employee_id is required' });

  const { start_date, end_date, reason } = req.body;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: 'end_date must be on or after start_date' });
  }

  const minDate = twoWeeksFromNow();
  if (start_date < minDate) {
    return res.status(400).json({
      error: `Time-off requests must be submitted at least 2 weeks in advance. Earliest allowed start date is ${minDate}.`,
    });
  }

  try {
    const request = await TimeOffRequest.create({
      employee_id: targetEmpId,
      start_date,
      end_date,
      reason: reason ?? null,
      status: 'pending',
    });
    const populated = await TimeOffRequest.findById(request._id).populate('employee_id', 'name');
    const obj = populated.toJSON();
    obj.employee_name = populated.employee_id?.name ?? null;
    obj.employee_id = populated.employee_id?._id.toString() ?? null;
    return res.status(201).json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/approve', requireManager, async (req, res) => {
  try {
    const existing = await TimeOffRequest.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Time-off request not found' });

    const { manager_notes } = req.body;
    existing.status = 'approved';
    existing.manager_notes = manager_notes ?? null;
    await existing.save();

    const updated = await TimeOffRequest.findById(req.params.id).populate('employee_id', 'name');
    const obj = updated.toJSON();
    obj.employee_name = updated.employee_id?.name ?? null;
    obj.employee_id = updated.employee_id?._id.toString() ?? null;
    return res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/reject', requireManager, async (req, res) => {
  try {
    const existing = await TimeOffRequest.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Time-off request not found' });

    const { manager_notes } = req.body;
    existing.status = 'rejected';
    existing.manager_notes = manager_notes ?? null;
    await existing.save();

    const updated = await TimeOffRequest.findById(req.params.id).populate('employee_id', 'name');
    const obj = updated.toJSON();
    obj.employee_name = updated.employee_id?.name ?? null;
    obj.employee_id = updated.employee_id?._id.toString() ?? null;
    return res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await TimeOffRequest.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Time-off request not found' });

    if (!req.user?.isManager) {
      if (req.user?.employeeId !== existing.employee_id?.toString()) {
        return res.status(403).json({ error: 'You can only cancel your own time-off requests' });
      }
      if (existing.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending requests can be cancelled' });
      }
    }

    await TimeOffRequest.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
