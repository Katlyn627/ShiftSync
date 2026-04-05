/**
 * /api/notifications — In-app notification inbox for employees
 *
 * Notifications are created automatically when:
 *   - A callout is reported with auto_open_shift=true (eligible co-workers notified)
 *   - A manager posts a new open shift (eligible employees notified)
 *   - A swap request is approved or rejected
 *   - A time-off request is approved or rejected
 *
 * Employees can only read/mark their own notifications.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

/** GET /api/notifications — list notifications for the current user */
router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  const { unread_only } = req.query as Record<string, string | undefined>;

  const rows = db.prepare(`
    SELECT * FROM notifications
    WHERE employee_id = ?
    ${unread_only === 'true' ? 'AND read_at IS NULL' : ''}
    ORDER BY created_at DESC
    LIMIT 100
  `).all(employeeId);

  const unreadCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM notifications WHERE employee_id = ? AND read_at IS NULL'
  ).get(employeeId) as { cnt: number }).cnt;

  res.json({ notifications: rows, unread_count: unreadCount });
});

/** PUT /api/notifications/:id/read — mark a single notification as read */
router.put('/:id/read', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id) as any;
  if (!notif) return res.status(404).json({ error: 'Notification not found' });
  if (notif.employee_id !== employeeId) return res.status(403).json({ error: 'Forbidden' });

  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND read_at IS NULL").run(req.params.id);
  res.json(db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id));
});

/** PUT /api/notifications/read-all — mark all notifications as read */
router.put('/read-all', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE employee_id = ? AND read_at IS NULL").run(employeeId);
  res.json({ success: true });
});

export default router;

/**
 * Helper: create a notification record (called from other route handlers).
 */
export function createNotification(params: {
  employee_id: number;
  type: string;
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO notifications (employee_id, type, title, body, link, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    params.employee_id,
    params.type,
    params.title,
    params.body ?? '',
    params.link ?? null,
    JSON.stringify(params.data ?? {}),
  );
}
