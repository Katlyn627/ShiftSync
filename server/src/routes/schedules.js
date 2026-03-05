import { Router } from 'express';
import Schedule from '../models/Schedule.js';
import Shift from '../models/Shift.js';
import { generateSchedule, computeWeeklyStaffingNeeds } from '../scheduler.js';
import { getLaborCostSummary } from '../laborCost.js';
import { calculateBurnoutRisks } from '../burnout.js';
import { requireManager } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const schedules = await Schedule.find().sort({ week_start: -1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate', requireManager, async (req, res) => {
  const { week_start, labor_budget } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start is required' });
  try {
    const scheduleId = await generateSchedule({ weekStart: week_start, laborBudget: labor_budget ?? 5000 });
    const schedule = await Schedule.findById(scheduleId);
    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/staffing-suggestions', requireManager, async (req, res) => {
  const { week_start } = req.query;
  if (!week_start) return res.status(400).json({ error: 'week_start query parameter is required' });
  try {
    const suggestions = await computeWeeklyStaffingNeeds(week_start);
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireManager, async (req, res) => {
  const { status } = req.body;
  try {
    const existing = await Schedule.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });
    if (status) existing.status = status;
    await existing.save();
    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireManager, async (req, res) => {
  try {
    const result = await Schedule.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Schedule not found' });
    await Shift.deleteMany({ schedule_id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/shifts', async (req, res) => {
  try {
    const shifts = await Shift.find({ schedule_id: req.params.id })
      .populate('employee_id', 'name role hourly_rate')
      .sort({ date: 1, start_time: 1 });

    const result = shifts.map(s => {
      const obj = s.toJSON();
      if (s.employee_id) {
        obj.employee_name = s.employee_id.name;
        obj.employee_role = s.employee_id.role;
        obj.hourly_rate = s.employee_id.hourly_rate;
        obj.employee_id = s.employee_id._id.toString();
      }
      return obj;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/labor-cost', requireManager, async (req, res) => {
  try {
    const summary = await getLaborCostSummary(req.params.id);
    res.json(summary);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/burnout-risks', async (req, res) => {
  try {
    const risks = await calculateBurnoutRisks(req.params.id);
    res.json(risks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/turnover-risks', async (req, res) => {
  try {
    const burnoutRisks = await calculateBurnoutRisks(req.params.id);
    const turnoverRisks = burnoutRisks.map(risk => {
      let turnover_risk;
      let reason;
      if (risk.risk_level === 'high') {
        turnover_risk = 'high';
        reason = 'High burnout risk strongly correlates with turnover intent';
      } else if (risk.risk_level === 'medium') {
        turnover_risk = 'medium';
        reason = 'Moderate stress factors may affect long-term retention';
      } else {
        turnover_risk = 'low';
        reason = 'Schedule conditions suggest stable retention';
      }
      return {
        employee_id: risk.employee_id,
        employee_name: risk.employee_name,
        turnover_risk,
        reason,
        risk_score: risk.risk_score,
        burnout_risk: risk.risk_level,
      };
    });
    res.json(turnoverRisks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
