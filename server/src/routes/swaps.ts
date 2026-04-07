import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { logAudit } from './audit';
import { createNotification } from './notifications';
import { sendSystemMessage } from './messages';

const router = Router();

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const baseQuery = `
    SELECT sw.*, 
      e1.name as requester_name, 
      e2.name as target_name,
      s.date as shift_date, s.start_time, s.end_time, s.role as shift_role
    FROM shift_swaps sw
    JOIN employees e1 ON sw.requester_id = e1.id
    LEFT JOIN employees e2 ON sw.target_id = e2.id
    JOIN shifts s ON sw.shift_id = s.id
  `;
  const swaps = siteId
    ? db.prepare(`${baseQuery} WHERE e1.site_id = ? ORDER BY sw.created_at DESC`).all(siteId)
    : db.prepare(`${baseQuery} ORDER BY sw.created_at DESC`).all();
  res.json(swaps);
});

router.post('/', (req: Request, res: Response) => {
  const { shift_id, requester_id, target_id, reason } = req.body;
  if (!shift_id || !requester_id) {
    return res.status(400).json({ error: 'shift_id and requester_id are required' });
  }
  const db = getDb();

  // Guardrail: verify requester owns the shift
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id) as any;
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  if (shift.employee_id !== requester_id) {
    return res.status(403).json({ error: 'Requester does not own this shift' });
  }

  // Guardrail: if target specified, check role compatibility
  if (target_id) {
    const target = db.prepare('SELECT * FROM employees WHERE id = ?').get(target_id) as any;
    if (!target) return res.status(404).json({ error: 'Target employee not found' });
    if (target.role !== shift.role && target.role !== 'Manager') {
      return res.status(400).json({ error: `Target role mismatch: shift requires ${shift.role}, target is ${target.role}` });
    }

    // Guardrail: check target weekly hours won't exceed max
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(shift.schedule_id) as any;
    const existingShifts = db.prepare(
      "SELECT * FROM shifts WHERE employee_id = ? AND date LIKE ? AND status != 'cancelled'"
    ).all(target_id, `${schedule.week_start.substring(0, 7)}%`) as any[];

    let totalHours = 0;
    const shiftHours = (() => {
      const s = shift.start_time.split(':').map(Number);
      const e = shift.end_time.split(':').map(Number);
      const sMin = s[0] * 60 + s[1];
      let eMin = e[0] * 60 + e[1];
      if (eMin < sMin) eMin += 24 * 60;
      return (eMin - sMin) / 60;
    })();
    for (const s of existingShifts) {
      const sm = s.start_time.split(':').map(Number);
      const em = s.end_time.split(':').map(Number);
      const smMin = sm[0] * 60 + sm[1];
      let emMin = em[0] * 60 + em[1];
      if (emMin < smMin) emMin += 24 * 60;
      totalHours += (emMin - smMin) / 60;
    }
    if (totalHours + shiftHours > target.weekly_hours_max) {
      return res.status(400).json({ error: `Swap would put target employee over their weekly hour limit (${target.weekly_hours_max}h)` });
    }
  }

  const result = db.prepare(
    'INSERT INTO shift_swaps (shift_id, requester_id, target_id, reason) VALUES (?, ?, ?, ?)'
  ).run(shift_id, requester_id, target_id ?? null, reason ?? null);

  const swap = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(result.lastInsertRowid) as any;
  const requester = db.prepare('SELECT * FROM employees WHERE id = ?').get(requester_id) as any;
  const requesterName = requester?.name ?? 'A coworker';
  const siteId = requester?.site_id ?? null;

  // Notify target employee about the swap request and send them a direct message
  if (target_id) {
    createNotification({
      employee_id: target_id,
      type: 'swap_request_received',
      title: '🔄 Swap Request Received',
      body: `${requesterName} wants to swap their ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}) with you. Go to Shift Swaps to review it.`,
      link: '/swaps',
      data: { swap_id: swap.id, shift_id: swap.shift_id },
    });

    // Send a direct message from requester to target in the messaging app
    sendSystemMessage({
      senderEmployeeId: requester_id,
      recipientEmployeeId: target_id,
      body: `🔄 Hi! I'd like to swap my ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}) with you.${reason ? ` Reason: ${reason}` : ''}\n\nPlease check the Shift Swaps page to review and respond.`,
      siteId,
    });
  }

  // Notify managers at the same site about the swap request
  const managers = db.prepare(`
    SELECT e.id as employee_id, e.name
    FROM users u
    JOIN employees e ON e.id = u.employee_id
    WHERE u.is_manager = 1 AND e.site_id = ?
  `).all(siteId) as any[];
  for (const mgr of managers) {
    createNotification({
      employee_id: mgr.employee_id,
      type: 'swap_request_created',
      title: '🔄 New Swap Request',
      body: target_id
        ? `${requesterName} has requested a shift swap for their ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}). Review it in Shift Swaps.`
        : `${requesterName} wants to drop their ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}). Review it in Shift Swaps.`,
      link: '/swaps',
      data: { swap_id: swap.id, shift_id: swap.shift_id },
    });
  }

  res.status(201).json(swap);
});

router.put('/:id/approve', requireManager, (req: Request, res: Response) => {
  const { manager_notes } = req.body;
  const db = getDb();
  const swap = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(req.params.id) as any;
  if (!swap) return res.status(404).json({ error: 'Swap not found' });
  if (swap.status !== 'pending') return res.status(400).json({ error: 'Swap is not pending' });

  db.prepare('UPDATE shift_swaps SET status=?, manager_notes=? WHERE id=?').run('approved', manager_notes ?? null, req.params.id);
  
  // Transfer the shift to the target employee
  if (swap.target_id) {
    db.prepare("UPDATE shifts SET employee_id=?, status='swapped' WHERE id=?").run(swap.target_id, swap.shift_id);
  }

  logAudit({
    action: 'swap_approved',
    entity_type: 'swap',
    entity_id: swap.id,
    user_id: req.user?.userId,
    details: { shift_id: swap.shift_id, requester_id: swap.requester_id, target_id: swap.target_id },
  });

  // Send approval notifications to both parties and direct messages
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(swap.shift_id) as any;
  if (shift) {
    const targetEmployee = swap.target_id
      ? (db.prepare('SELECT * FROM employees WHERE id = ?').get(swap.target_id) as any)
      : null;
    const targetName = targetEmployee?.name ?? null;
    const requesterEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(swap.requester_id) as any;
    const requesterName = requesterEmployee?.name ?? 'A coworker';
    const managerEmployeeId = req.user?.employeeId ?? null;
    const siteId = requesterEmployee?.site_id ?? null;

    // Notify requester
    createNotification({
      employee_id: swap.requester_id,
      type: 'swap_approved',
      title: '✅ Shift Drop/Swap Approved',
      body: swap.target_id
        ? `Your swap request for the ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}) has been approved. ${targetName} will cover it.${manager_notes ? ` Manager note: ${manager_notes}` : ''}`
        : `Your request to drop your ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}) has been approved. It is now open for pickup.${manager_notes ? ` Manager note: ${manager_notes}` : ''}`,
      link: '/schedule',
      data: { swap_id: swap.id, shift_id: swap.shift_id },
    });

    // Send direct message to requester from the manager
    if (managerEmployeeId) {
      const requesterMsg = swap.target_id
        ? `✅ Your shift swap for the ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}) has been approved. ${targetName} will cover your shift.${manager_notes ? `\n\nNote: ${manager_notes}` : ''}`
        : `✅ Your request to drop the ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}) has been approved. The shift is now open for pickup.${manager_notes ? `\n\nNote: ${manager_notes}` : ''}`;
      sendSystemMessage({
        senderEmployeeId: managerEmployeeId,
        recipientEmployeeId: swap.requester_id,
        body: requesterMsg,
        siteId,
      });
    }

    // Notify target that they are now scheduled for the shift and send them a message
    if (swap.target_id && targetEmployee) {
      createNotification({
        employee_id: swap.target_id,
        type: 'swap_approved',
        title: '📅 You\'ve Been Assigned a Shift',
        body: `Your shift swap with ${requesterName} has been approved. You are now scheduled for the ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}).${manager_notes ? ` Manager note: ${manager_notes}` : ''}`,
        link: '/schedule',
        data: { swap_id: swap.id, shift_id: swap.shift_id },
      });

      // Send direct message to target from the manager
      if (managerEmployeeId) {
        sendSystemMessage({
          senderEmployeeId: managerEmployeeId,
          recipientEmployeeId: swap.target_id,
          body: `📅 The shift swap with ${requesterName} has been approved. You are now scheduled for the ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}).${manager_notes ? `\n\nNote: ${manager_notes}` : ''}`,
          siteId,
        });
      }
    }
  }

  const updated = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.put('/:id/reject', requireManager, (req: Request, res: Response) => {
  const { manager_notes } = req.body;
  const db = getDb();
  const swap = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(req.params.id) as any;
  if (!swap) return res.status(404).json({ error: 'Swap not found' });
  if (swap.status !== 'pending') return res.status(400).json({ error: 'Swap is not pending' });

  db.prepare('UPDATE shift_swaps SET status=?, manager_notes=? WHERE id=?').run('rejected', manager_notes ?? null, req.params.id);
  logAudit({
    action: 'swap_rejected',
    entity_type: 'swap',
    entity_id: swap.id,
    user_id: req.user?.userId,
    details: { shift_id: swap.shift_id, requester_id: swap.requester_id },
  });

  // Notify requester that the swap/drop request was rejected and send a direct message
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(swap.shift_id) as any;
  if (shift) {
    createNotification({
      employee_id: swap.requester_id,
      type: 'swap_rejected',
      title: '❌ Shift Drop/Swap Not Approved',
      body: `Your request for the ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}) was not approved. You are still scheduled for this shift.${manager_notes ? ` Manager note: ${manager_notes}` : ''}`,
      link: '/swaps',
      data: { swap_id: swap.id, shift_id: swap.shift_id },
    });

    // Send direct message from manager to requester
    const managerEmployeeId = req.user?.employeeId ?? null;
    if (managerEmployeeId) {
      const requesterEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(swap.requester_id) as any;
      const siteId = requesterEmployee?.site_id ?? null;
      sendSystemMessage({
        senderEmployeeId: managerEmployeeId,
        recipientEmployeeId: swap.requester_id,
        body: `❌ Your request for the ${shift.role} shift on ${shift.date} (${shift.start_time}–${shift.end_time}) was not approved. You remain scheduled for this shift.${manager_notes ? `\n\nNote: ${manager_notes}` : ''}`,
        siteId,
      });
    }
  }

  const updated = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;