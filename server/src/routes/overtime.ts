import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const overtime = db.prepare(`
    SELECT wo.*, e.name as employee_name, e.role, e.site_id
    FROM weekly_overtime wo
    JOIN employees e ON wo.employee_id = e.id
    ORDER BY wo.week_start DESC, e.name
  `).all();
  res.json(overtime);
});

router.get('/employee/:id', requireAuth, (req, res) => {
  const db = getDb();
  const overtime = db.prepare(`
    SELECT wo.*, e.name as employee_name, e.role
    FROM weekly_overtime wo
    JOIN employees e ON wo.employee_id = e.id
    WHERE wo.employee_id = ?
    ORDER BY wo.week_start DESC
  `).all(req.params.id);
  res.json(overtime);
});

export default router;
