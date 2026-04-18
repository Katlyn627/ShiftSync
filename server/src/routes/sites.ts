import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireManager } from '../middleware/auth';

const router = Router();

function normalizeRolesForStorage(value: unknown, fallback = '[]'): string {
  if (value == null) return fallback;
  if (Array.isArray(value)) {
    const normalized = value
      .filter((role): role is string => typeof role === 'string')
      .map(role => role.trim())
      .filter(Boolean);
    return JSON.stringify(normalized);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .filter((role): role is string => typeof role === 'string')
          .map(role => role.trim())
          .filter(Boolean);
        return JSON.stringify(normalized);
      }
    } catch {
      return JSON.stringify(value.split(',').map(v => v.trim()).filter(Boolean));
    }
  }
  return fallback;
}

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const sites = db.prepare('SELECT * FROM sites ORDER BY name').all();
  res.json(sites);
});

router.post('/', requireManager, (req: Request, res: Response) => {
  const { name, city, state, timezone, site_type, jurisdiction, address, business_hours, employee_capacity, foh_roles, boh_roles } = req.body;
  if (!name || !city || !state) {
    return res.status(400).json({ error: 'name, city, and state are required' });
  }
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO sites (
      name, city, state, timezone, site_type, jurisdiction,
      address, business_hours, employee_capacity, foh_roles, boh_roles
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name,
    city,
    state,
    timezone ?? 'America/New_York',
    site_type ?? 'restaurant',
    jurisdiction ?? 'default',
    address ?? '',
    business_hours ?? '',
    employee_capacity ?? 0,
    normalizeRolesForStorage(foh_roles),
    normalizeRolesForStorage(boh_roles),
  );
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(site);
});

router.get('/:id', (_req: Request, res: Response) => {
  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(_req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json(site);
});

router.get('/:id/employees', (_req: Request, res: Response) => {
  const db = getDb();
  const employees = db.prepare('SELECT * FROM employees WHERE site_id = ? ORDER BY name').all(_req.params.id);
  res.json(employees);
});

/** PUT /api/sites/:id — update site details including jurisdiction (manager only) */
router.put('/:id', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Site not found' });

  const { name, city, state, timezone, site_type, jurisdiction, address, business_hours, employee_capacity, foh_roles, boh_roles } = req.body;
  db.prepare(
    `UPDATE sites
      SET name=?, city=?, state=?, timezone=?, site_type=?, jurisdiction=?,
          address=?, business_hours=?, employee_capacity=?, foh_roles=?, boh_roles=?
      WHERE id=?`
  ).run(
    name ?? existing.name,
    city ?? existing.city,
    state ?? existing.state,
    timezone ?? existing.timezone,
    site_type ?? existing.site_type,
    jurisdiction ?? existing.jurisdiction,
    address ?? existing.address ?? '',
    business_hours ?? existing.business_hours ?? '',
    employee_capacity ?? existing.employee_capacity ?? 0,
    normalizeRolesForStorage(foh_roles, existing.foh_roles ?? '[]'),
    normalizeRolesForStorage(boh_roles, existing.boh_roles ?? '[]'),
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
