import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

router.put('/:id', requireAuth, requireManager, (req, res) => {
  const { start_time, end_time, status } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Shift not found' });
  db.prepare('UPDATE shifts SET start_time=?, end_time=?, status=? WHERE id=?').run(
    start_time ?? existing.start_time,
    end_time ?? existing.end_time,
    status ?? existing.status,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', requireAuth, requireManager, (req, res) => {
  const db = getDb();
  const result = db.prepare('UPDATE shifts SET status=? WHERE id=?').run('cancelled', req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Shift not found' });
  res.json({ success: true });
});

export default router;
