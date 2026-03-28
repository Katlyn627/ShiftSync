/**
 * /api/compliance — Compliance rules management
 *
 * These routes allow managers to view and customise per-jurisdiction compliance rules
 * (rest windows, notice periods, minor/union constraints, etc.).
 * Read endpoints are accessible to all authenticated users so the scheduler and UI can
 * surface the rules that apply to each worksite.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { ComplianceRule } from '../types';

const router = Router();

/** GET /api/compliance — list all rules, optionally filtered by ?jurisdiction=<code> */
router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const { jurisdiction } = req.query as { jurisdiction?: string };
  const rules: ComplianceRule[] = jurisdiction
    ? (db.prepare(
        'SELECT * FROM compliance_rules WHERE jurisdiction = ? ORDER BY jurisdiction, rule_type'
      ).all(jurisdiction) as ComplianceRule[])
    : (db.prepare(
        'SELECT * FROM compliance_rules ORDER BY jurisdiction, rule_type'
      ).all() as ComplianceRule[]);
  res.json(rules);
});

/** GET /api/compliance/jurisdictions — list distinct jurisdiction codes present in the DB */
router.get('/jurisdictions', requireAuth, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT DISTINCT jurisdiction FROM compliance_rules ORDER BY jurisdiction'
  ).all() as { jurisdiction: string }[];
  res.json(rows.map(r => r.jurisdiction));
});

/** GET /api/compliance/:id — single rule detail */
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const rule = db.prepare('SELECT * FROM compliance_rules WHERE id = ?').get(req.params.id) as ComplianceRule | undefined;
  if (!rule) return res.status(404).json({ error: 'Compliance rule not found' });
  res.json(rule);
});

/** POST /api/compliance — create a new rule (manager only) */
router.post('/', requireManager, (req: Request, res: Response) => {
  const { jurisdiction, rule_type, rule_value, description } = req.body as Partial<ComplianceRule>;
  if (!jurisdiction || !rule_type || rule_value === undefined) {
    return res.status(400).json({ error: 'jurisdiction, rule_type, and rule_value are required' });
  }
  const db = getDb();
  try {
    const result = db.prepare(
      'INSERT INTO compliance_rules (jurisdiction, rule_type, rule_value, description) VALUES (?, ?, ?, ?)'
    ).run(jurisdiction, rule_type, String(rule_value), description ?? '');
    const created = db.prepare('SELECT * FROM compliance_rules WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: `A rule for jurisdiction '${jurisdiction}' and rule_type '${rule_type}' already exists. Use PUT to update it.` });
    }
    throw err;
  }
});

/** PUT /api/compliance/:id — update rule_value, description, or enabled flag (manager only) */
router.put('/:id', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM compliance_rules WHERE id = ?').get(req.params.id) as ComplianceRule | undefined;
  if (!existing) return res.status(404).json({ error: 'Compliance rule not found' });

  const { rule_value, description, enabled } = req.body as Partial<ComplianceRule>;
  db.prepare(
    'UPDATE compliance_rules SET rule_value=?, description=?, enabled=? WHERE id=?'
  ).run(
    rule_value !== undefined ? String(rule_value) : existing.rule_value,
    description !== undefined ? description : existing.description,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM compliance_rules WHERE id = ?').get(req.params.id);
  res.json(updated);
});

/** DELETE /api/compliance/:id — remove a rule (manager only) */
router.delete('/:id', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM compliance_rules WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Compliance rule not found' });
  res.json({ success: true });
});

/**
 * Helper exported for use in other modules (scheduler, burnout).
 * Returns a plain object mapping rule_type → numeric value for the given jurisdiction.
 * Falls back to 'default' rules for any missing rule_type.
 */
export function getComplianceConfig(jurisdiction: string): Record<string, number> {
  const db = getDb();
  const defaultRules = db.prepare(
    "SELECT rule_type, rule_value FROM compliance_rules WHERE jurisdiction = 'default' AND enabled = 1"
  ).all() as { rule_type: string; rule_value: string }[];

  const jurisdictionRules = jurisdiction !== 'default'
    ? (db.prepare(
        'SELECT rule_type, rule_value FROM compliance_rules WHERE jurisdiction = ? AND enabled = 1'
      ).all(jurisdiction) as { rule_type: string; rule_value: string }[])
    : [];

  // Merge: jurisdiction-specific rules override defaults
  const merged: Record<string, number> = {};
  for (const r of defaultRules) {
    merged[r.rule_type] = parseFloat(r.rule_value);
  }
  for (const r of jurisdictionRules) {
    merged[r.rule_type] = parseFloat(r.rule_value);
  }
  return merged;
}

export default router;
