import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { generateSchedule, computeWeeklyStaffingNeeds } from '../scheduler';
import { getLaborCostSummary } from '../laborCost';
import { requireManager, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const schedules = siteId
    ? db.prepare('SELECT * FROM schedules WHERE site_id = ? ORDER BY week_start DESC').all(siteId)
    : db.prepare('SELECT * FROM schedules ORDER BY week_start DESC').all();
  res.json(schedules);
});

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function addDaysToIso(baseIsoDate: string, days: number): string {
  const [year, month, day] = baseIsoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function normalizedRoleKey(role: string) {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'bar') return 'bartender';
  return normalized;
}

function displayRoleName(roleKey: string) {
  if (roleKey === 'bartender') return 'Bartender';
  return roleKey
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

router.post('/generate', requireManager, (req: Request, res: Response) => {
  const { week_start, labor_budget } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start is required' });
  try {
    const siteId = req.user?.siteId ?? null;
    const scheduleId = generateSchedule({ weekStart: week_start, laborBudget: labor_budget ?? 5000, siteId });
    const db = getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
    res.status(201).json(schedule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/duplicate', requireManager, (req: Request, res: Response) => {
  const sourceId = Number(req.params.id);
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    return res.status(400).json({ error: 'Invalid schedule id' });
  }

  const targetDate = parseDateOnly(req.body?.target_week_start);
  if (!targetDate) {
    return res.status(400).json({ error: 'target_week_start must be a valid YYYY-MM-DD date' });
  }
  const formattedTargetWeekStart = targetDate.toISOString().slice(0, 10);

  const db = getDb();
  const sourceSchedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(sourceId) as any;
  if (!sourceSchedule) {
    return res.status(404).json({ error: 'Source schedule not found' });
  }

  if (req.user?.siteId != null && sourceSchedule.site_id != null && sourceSchedule.site_id !== req.user.siteId) {
    return res.status(403).json({ error: 'You can only manage schedules for your site' });
  }

  const sourceDate = parseDateOnly(sourceSchedule.week_start);
  if (!sourceDate) {
    return res.status(400).json({ error: 'Source schedule has an invalid week_start date' });
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((targetDate.getTime() - sourceDate.getTime()) / dayMs);

  const sourceShifts = db.prepare(
    "SELECT employee_id, date, start_time, end_time, role FROM shifts WHERE schedule_id = ? AND status != 'cancelled'"
  ).all(sourceId) as Array<{ employee_id: number | null; date: string; start_time: string; end_time: string; role: string }>;

  const laborBudget = Number(req.body?.labor_budget) || sourceSchedule.labor_budget || 5000;

  const tx = db.transaction(() => {
    const schedResult = db.prepare(
      "INSERT INTO schedules (week_start, labor_budget, status, site_id) VALUES (?, ?, 'draft', ?)"
    ).run(formattedTargetWeekStart, laborBudget, sourceSchedule.site_id ?? req.user?.siteId ?? null);
    const newScheduleId = Number(schedResult.lastInsertRowid);

    const insertShift = db.prepare(
      "INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
    );

    for (const shift of sourceShifts) {
      const newDate = addDaysToIso(shift.date, diffDays);
      insertShift.run(newScheduleId, shift.employee_id ?? null, newDate, shift.start_time, shift.end_time, shift.role);
    }

    return newScheduleId;
  });

  const createdId = tx();
  const newSchedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(createdId);
  res.status(201).json(newSchedule);
});

router.get('/staffing-suggestions', requireAuth, (req: Request, res: Response) => {
  const weekStart = typeof req.query.week_start === 'string' ? req.query.week_start.trim() : '';
  if (!weekStart) {
    return res.status(400).json({ error: 'week_start is required (YYYY-MM-DD)' });
  }

  const parsed = parseDateOnly(weekStart);
  if (!parsed) {
    return res.status(400).json({ error: 'week_start must be a valid YYYY-MM-DD date' });
  }

  try {
    const siteId = req.user?.siteId ?? null;
    const suggestions = computeWeeklyStaffingNeeds(weekStart, siteId);
    const weekEnd = addDaysToIso(weekStart, 6);
    const db = getDb();

    const actualShifts = siteId
      ? db.prepare(`
          SELECT s.date, s.role
          FROM shifts s
          INNER JOIN schedules sched ON sched.id = s.schedule_id
          WHERE sched.site_id = ?
            AND sched.week_start = ?
            AND s.status != 'cancelled'
            AND s.date BETWEEN ? AND ?
        `).all(siteId, weekStart, weekStart, weekEnd) as Array<{ date: string; role: string }>
      : db.prepare(`
          SELECT s.date, s.role
          FROM shifts s
          INNER JOIN schedules sched ON sched.id = s.schedule_id
          WHERE sched.week_start = ?
            AND s.status != 'cancelled'
            AND s.date BETWEEN ? AND ?
        `).all(weekStart, weekStart, weekEnd) as Array<{ date: string; role: string }>;

    const actualByDate = new Map<string, Map<string, number>>();
    actualShifts.forEach((shift) => {
      const dayMap = actualByDate.get(shift.date) || new Map<string, number>();
      const key = normalizedRoleKey(shift.role);
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
      actualByDate.set(shift.date, dayMap);
    });

    const enriched = suggestions.map((day) => {
      const suggestedByRole = new Map<string, number>();
      day.staffing.forEach((need) => {
        const key = normalizedRoleKey(need.role);
        suggestedByRole.set(key, (suggestedByRole.get(key) || 0) + need.count);
      });

      const actualByRole = actualByDate.get(day.date) || new Map<string, number>();
      const allRoles = new Set<string>([...suggestedByRole.keys(), ...actualByRole.keys()]);

      const roleDeltas = Array.from(allRoles)
        .map((roleKey) => {
          const suggested = suggestedByRole.get(roleKey) || 0;
          const actual = actualByRole.get(roleKey) || 0;
          return {
            role: displayRoleName(roleKey),
            delta: actual - suggested,
            suggested,
            actual,
          };
        })
        .filter((entry) => entry.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

      const suggested = day.staffing.reduce((total, slot) => total + slot.count, 0);
      const actual = Array.from(actualByRole.values()).reduce((total, count) => total + count, 0);
      const delta = actual - suggested;

      return {
        ...day,
        staffing_status: delta < 0 ? 'understaffed' : delta > 0 ? 'overstaffed' : 'adequate',
        staffing_delta: delta,
        staffing_actual: actual,
        staffing_suggested: suggested,
        role_deltas: roleDeltas,
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compute staffing suggestions' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json(schedule);
});

router.put('/:id', requireManager, (req: Request, res: Response) => {
  const { status } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });
  if (status) db.prepare('UPDATE schedules SET status=? WHERE id=?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Schedule not found' });
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/shifts', (req: Request, res: Response) => {
  const db = getDb();
  const shifts = db.prepare(`
    SELECT s.*, e.name as employee_name, e.role as employee_role, e.department as employee_department, e.hourly_rate
    FROM shifts s
    LEFT JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ? AND s.status != 'cancelled'
    ORDER BY s.date, s.start_time, COALESCE(e.name, '')
  `).all(req.params.id);
  res.json(shifts);
});

router.get('/:id/labor-cost', requireManager, (req: Request, res: Response) => {
  try {
    const summary = getLaborCostSummary(parseInt(req.params.id));
    res.json(summary);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
