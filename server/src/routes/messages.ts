/**
 * /api/messages — In-app messaging (direct messages and group chats)
 *
 * Employees and managers can send direct messages or participate in group
 * conversations. Conversations are scoped to the same site.
 *
 * Routes:
 *   GET  /api/messages/conversations          — list conversations for current user
 *   POST /api/messages/conversations          — start a new direct or group conversation
 *   GET  /api/messages/conversations/:id      — get conversation detail + messages
 *   POST /api/messages/conversations/:id      — send a message to a conversation
 *   PUT  /api/messages/conversations/:id/read — mark conversation as read
 *   POST /api/messages/broadcast              — send a mass alert to all site employees (manager only)
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

/** GET /api/messages/conversations — list conversations the current employee belongs to */
router.get('/conversations', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  const conversations = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
      (SELECT COUNT(*) FROM messages m
       WHERE m.conversation_id = c.id
         AND m.created_at > COALESCE((
           SELECT cm2.last_read_at FROM conversation_members cm2
           WHERE cm2.conversation_id = c.id AND cm2.employee_id = ?
         ), '1970-01-01')
         AND m.sender_id != ?
      ) as unread_count,
      (SELECT m2.body FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) as last_message,
      (SELECT m2.created_at FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) as last_message_at
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.employee_id = ?
    ORDER BY COALESCE(last_message_at, c.created_at) DESC
  `).all(employeeId, employeeId, employeeId) as any[];

  // For each conversation attach member list
  const result = conversations.map((conv: any) => {
    const members = db.prepare(`
      SELECT e.id, e.name, e.role, e.photo_url, cm.last_read_at
      FROM conversation_members cm
      JOIN employees e ON e.id = cm.employee_id
      WHERE cm.conversation_id = ?
    `).all(conv.id);
    return { ...conv, members };
  });

  res.json(result);
});

/** POST /api/messages/conversations — create a new conversation */
router.post('/conversations', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  const { member_ids, title, type = 'direct' } = req.body as {
    member_ids: number[];
    title?: string;
    type?: 'direct' | 'group';
  };

  if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
    return res.status(400).json({ error: 'member_ids array is required' });
  }

  const allMembers = [...new Set([employeeId, ...member_ids])];

  // For direct messages, reuse an existing conversation if one exists between these two employees
  if (type === 'direct' && allMembers.length === 2) {
    const existing = db.prepare(`
      SELECT c.id FROM conversations c
      WHERE c.type = 'direct'
        AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) = 2
        AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.employee_id = ?)
        AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.employee_id = ?)
    `).get(allMembers[0], allMembers[1]) as any;
    if (existing) {
      return res.json(db.prepare('SELECT * FROM conversations WHERE id = ?').get(existing.id));
    }
  }

  const siteId = req.user?.siteId ?? null;
  const result = db.prepare(`
    INSERT INTO conversations (type, title, site_id, created_by)
    VALUES (?, ?, ?, ?)
  `).run(type, title ?? null, siteId, employeeId);

  const convId = result.lastInsertRowid as number;

  const addMember = db.prepare(`
    INSERT OR IGNORE INTO conversation_members (conversation_id, employee_id) VALUES (?, ?)
  `);
  for (const memberId of allMembers) {
    addMember.run(convId, memberId);
  }

  res.status(201).json(db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId));
});

/** GET /api/messages/conversations/:id — fetch messages in a conversation */
router.get('/conversations/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as any;
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const membership = db.prepare(
    'SELECT * FROM conversation_members WHERE conversation_id = ? AND employee_id = ?'
  ).get(req.params.id, employeeId) as any;
  if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' });

  const messages = db.prepare(`
    SELECT m.*, e.name as sender_name, e.role as sender_role, e.photo_url as sender_photo
    FROM messages m
    JOIN employees e ON e.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
    LIMIT 200
  `).all(req.params.id);

  const members = db.prepare(`
    SELECT e.id, e.name, e.role, e.photo_url, cm.last_read_at
    FROM conversation_members cm
    JOIN employees e ON e.id = cm.employee_id
    WHERE cm.conversation_id = ?
  `).all(req.params.id);

  res.json({ conversation: conv, messages, members });
});

/** POST /api/messages/conversations/:id — send a message */
router.post('/conversations/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as any;
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const membership = db.prepare(
    'SELECT * FROM conversation_members WHERE conversation_id = ? AND employee_id = ?'
  ).get(req.params.id, employeeId);
  if (!membership) return res.status(403).json({ error: 'You are not a member of this conversation' });

  const { body } = req.body as { body: string };
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });

  const result = db.prepare(`
    INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)
  `).run(req.params.id, employeeId, body.trim());

  db.prepare("UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?").run(req.params.id);

  // Mark as read for sender
  db.prepare(
    "UPDATE conversation_members SET last_read_at = datetime('now') WHERE conversation_id = ? AND employee_id = ?"
  ).run(req.params.id, employeeId);

  const message = db.prepare(`
    SELECT m.*, e.name as sender_name, e.role as sender_role, e.photo_url as sender_photo
    FROM messages m JOIN employees e ON e.id = m.sender_id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(message);
});

/** PUT /api/messages/conversations/:id/read — mark conversation as read */
router.put('/conversations/:id/read', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  db.prepare(
    "UPDATE conversation_members SET last_read_at = datetime('now') WHERE conversation_id = ? AND employee_id = ?"
  ).run(req.params.id, employeeId);

  res.json({ success: true });
});

/**
 * POST /api/messages/broadcast — send a mass alert to all employees at the manager's site.
 *
 * Creates a new group conversation (or reuses one with the same title from today) and
 * adds every active employee at the site as a member. The manager's message is posted
 * immediately so all staff see it in their Messages inbox.
 *
 * Body: { title: string, body: string }
 * Returns: { conversation, recipient_count }
 */
router.post('/broadcast', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const senderEmployeeId = req.user?.employeeId;
  if (!senderEmployeeId) return res.status(403).json({ error: 'No employee record linked to this account' });

  const { title, body } = req.body as { title?: string; body?: string };
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });

  const siteId = req.user?.siteId ?? null;

  // Collect all employees at this site who have a linked user account (so they can receive messages),
  // excluding the sender themselves
  const employees: { id: number }[] = siteId
    ? (db.prepare(
        'SELECT e.id FROM employees e JOIN users u ON u.employee_id = e.id WHERE e.site_id = ? AND e.id != ?'
      ).all(siteId, senderEmployeeId) as any[])
    : (db.prepare(
        'SELECT e.id FROM employees e JOIN users u ON u.employee_id = e.id WHERE e.id != ?'
      ).all(senderEmployeeId) as any[]);

  const conversationTitle = title?.trim() || '📢 Staff Alert';

  // Create a fresh group conversation for this broadcast
  const result = db.prepare(
    "INSERT INTO conversations (type, title, site_id, created_by) VALUES ('group', ?, ?, ?)"
  ).run(conversationTitle, siteId, senderEmployeeId);
  const convId = result.lastInsertRowid as number;

  // Add sender + all site employees as members
  const addMember = db.prepare(
    'INSERT OR IGNORE INTO conversation_members (conversation_id, employee_id) VALUES (?, ?)'
  );
  addMember.run(convId, senderEmployeeId);
  for (const emp of employees) {
    addMember.run(convId, emp.id);
  }

  // Post the broadcast message
  db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)').run(
    convId, senderEmployeeId, body.trim()
  );
  db.prepare("UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?").run(convId);

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);

  res.status(201).json({
    conversation,
    recipient_count: employees.length,
  });
});

export default router;

/**
 * Helper: find or create a direct conversation between two employees and send a message.
 * Used by other route handlers (swaps, open-shifts) to send automated messages.
 */
export function sendSystemMessage(params: {
  senderEmployeeId: number;
  recipientEmployeeId: number;
  body: string;
  siteId?: number | null;
}): void {
  const db = getDb();
  const { senderEmployeeId, recipientEmployeeId, body, siteId } = params;

  // Find an existing direct conversation between the two employees
  const existing = db.prepare(`
    SELECT c.id FROM conversations c
    WHERE c.type = 'direct'
      AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) = 2
      AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.employee_id = ?)
      AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.employee_id = ?)
  `).get(senderEmployeeId, recipientEmployeeId) as any;

  let convId: number;
  if (existing) {
    convId = existing.id;
  } else {
    const result = db.prepare(
      "INSERT INTO conversations (type, title, site_id, created_by) VALUES ('direct', NULL, ?, ?)"
    ).run(siteId ?? null, senderEmployeeId);
    convId = result.lastInsertRowid as number;
    const addMember = db.prepare(
      'INSERT OR IGNORE INTO conversation_members (conversation_id, employee_id) VALUES (?, ?)'
    );
    addMember.run(convId, senderEmployeeId);
    addMember.run(convId, recipientEmployeeId);
  }

  db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)').run(
    convId, senderEmployeeId, body
  );
  db.prepare("UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?").run(convId);
}
