import { Router } from 'express';
import Forecast from '../models/Forecast.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const forecasts = await Forecast.find().sort({ date: 1 });
    res.json(forecasts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { date, expected_revenue, expected_covers } = req.body;
  if (!date || expected_revenue === undefined) {
    return res.status(400).json({ error: 'date and expected_revenue are required' });
  }
  try {
    const forecast = await Forecast.findOneAndUpdate(
      { date },
      { date, expected_revenue, expected_covers: expected_covers ?? 0 },
      { upsert: true, new: true }
    );
    res.status(201).json(forecast);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
