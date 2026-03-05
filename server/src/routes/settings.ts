import { Router } from 'express';
import { getRestaurantSettings, saveRestaurantSettings } from '../metrics';
import { requireManager } from '../middleware/auth';

const router = Router();

router.get('/', requireManager, (_req, res) => {
  try {
    res.json(getRestaurantSettings());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', requireManager, (req, res) => {
  const { seats, tables, cogs_pct, target_labor_pct, operating_hours_per_day } = req.body;
  const partial: Record<string, number> = {};
  if (seats               !== undefined) partial.seats               = Number(seats);
  if (tables              !== undefined) partial.tables              = Number(tables);
  if (cogs_pct            !== undefined) partial.cogs_pct            = Number(cogs_pct);
  if (target_labor_pct    !== undefined) partial.target_labor_pct    = Number(target_labor_pct);
  if (operating_hours_per_day !== undefined) partial.operating_hours_per_day = Number(operating_hours_per_day);
  try {
    res.json(saveRestaurantSettings(partial));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
