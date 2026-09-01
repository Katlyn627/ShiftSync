import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { getCampaignResults, generateSurveyRecommendations, computeSubscaleResults } from '../surveys';
import { SurveyQuestion } from '../types';

const router = Router();

// GET /api/surveys/templates - list available survey instruments
router.get('/templates', requireAuth, (_req: Request, res: Response) => {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM survey_templates WHERE active = 1 ORDER BY id').all();
  res.json(templates);
});

// GET /api/surveys/campaigns - list campaigns (managers see all/site; employees see active ones with responded state)
router.get('/campaigns', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId;
  const isManager = req.user?.isManager;
  const employeeId = req.user?.employeeId;

  let query = `
    SELECT c.*, t.instrument, t.name as template_name, t.description, t.questions,
      (SELECT COUNT(*) FROM survey_responses r WHERE r.campaign_id = c.id) as response_count
    FROM survey_campaigns c
    JOIN survey_templates t ON c.template_id = t.id
  `;
  const params: any[] = [];

  if (siteId) {
    query += ' WHERE (c.site_id = ? OR c.site_id IS NULL)';
    params.push(siteId);
  }

  query += ' ORDER BY c.start_date DESC, c.id DESC';
  const campaigns = db.prepare(query).all(...params) as any[];

  // Check if current employee already responded
  if (employeeId) {
    const userResponses = db.prepare(
      'SELECT campaign_id, created_at FROM survey_responses WHERE employee_id = ?'
    ).all(employeeId) as Array<{ campaign_id: number; created_at: string }>;
    const respondedMap = new Map(userResponses.map(r => [r.campaign_id, r.created_at]));

    campaigns.forEach(c => {
      if (respondedMap.has(c.id)) {
        c.already_responded = true;
        c.responded_at = respondedMap.get(c.id);
      } else {
        c.already_responded = false;
        c.responded_at = null;
      }
    });
  }

  res.json(campaigns);
});

// POST /api/surveys/campaigns - create a new survey campaign (manager only)
router.post('/campaigns', requireManager, (req: Request, res: Response) => {
  const {
    template_id,
    title,
    start_date,
    end_date,
    min_group_size,
    anonymized,
    recurrence,
    schedule_day_of_week,
    target_roles,
  } = req.body;

  if (!template_id || !title || !start_date || !end_date) {
    return res.status(400).json({ error: 'template_id, title, start_date, and end_date are required' });
  }

  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const template = db.prepare('SELECT * FROM survey_templates WHERE id = ?').get(template_id) as any;
  if (!template) {
    return res.status(404).json({ error: 'Survey template not found' });
  }

  const targetRolesJson = Array.isArray(target_roles)
    ? JSON.stringify(target_roles)
    : typeof target_roles === 'string'
      ? JSON.stringify(target_roles.split(',').map(s => s.trim()).filter(Boolean))
      : '[]';

  const result = db.prepare(`
    INSERT INTO survey_campaigns (
      template_id, site_id, title, start_date, end_date,
      anonymized, min_group_size, status, recurrence,
      schedule_day_of_week, target_roles
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    template_id,
    siteId,
    title,
    start_date,
    end_date,
    anonymized !== false ? 1 : 0,
    Number(min_group_size) || 5,
    recurrence === 'weekly' ? 'weekly' : 'none',
    recurrence === 'weekly' ? (schedule_day_of_week ?? 1) : null,
    targetRolesJson
  );

  const campaign = db.prepare(`
    SELECT c.*, t.instrument, t.name as template_name, t.description, t.questions
    FROM survey_campaigns c
    JOIN survey_templates t ON c.template_id = t.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(campaign);
});

// GET /api/surveys/campaigns/:id - campaign details
router.get('/campaigns/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const campaign = db.prepare(`
    SELECT c.*, t.instrument, t.name as template_name, t.description, t.questions
    FROM survey_campaigns c
    JOIN survey_templates t ON c.template_id = t.id
    WHERE c.id = ?
  `).get(req.params.id) as any;

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const employeeId = req.user?.employeeId;
  let alreadyResponded = false;
  let respondedAt = null;

  if (employeeId) {
    const existing = db.prepare(
      'SELECT created_at FROM survey_responses WHERE campaign_id = ? AND employee_id = ?'
    ).get(campaign.id, employeeId) as { created_at: string } | undefined;
    if (existing) {
      alreadyResponded = true;
      respondedAt = existing.created_at;
    }
  }

  res.json({
    ...campaign,
    already_responded: alreadyResponded,
    responded_at: respondedAt,
  });
});

// POST /api/surveys/campaigns/:id/respond - submit survey response
router.post('/campaigns/:id/respond', requireAuth, (req: Request, res: Response) => {
  const campaignId = Number(req.params.id);
  const { responses } = req.body;
  if (!responses || typeof responses !== 'object') {
    return res.status(400).json({ error: 'responses object is required' });
  }

  const db = getDb();
  const campaign = db.prepare('SELECT * FROM survey_campaigns WHERE id = ?').get(campaignId) as any;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status === 'closed') {
    return res.status(400).json({ error: 'This survey campaign is closed' });
  }

  const employeeId = req.user?.employeeId;
  let department = 'General';
  let roleTitle = 'Staff';
  let siteId = req.user?.siteId ?? campaign.site_id ?? null;

  if (employeeId) {
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as any;
    if (emp) {
      department = emp.department || 'General';
      roleTitle = emp.role_title || emp.role || 'Staff';
      siteId = emp.site_id || siteId;
    }

    // Check if employee already responded
    const prior = db.prepare(
      'SELECT id FROM survey_responses WHERE campaign_id = ? AND employee_id = ?'
    ).get(campaignId, employeeId);
    if (prior) {
      return res.status(400).json({ error: 'You have already submitted a response for this survey campaign.' });
    }
  }

  const tx = db.transaction(() => {
    const respResult = db.prepare(`
      INSERT INTO survey_responses (campaign_id, employee_id, department, role_title, site_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(campaignId, employeeId ?? null, department, roleTitle, siteId);

    const responseId = respResult.lastInsertRowid as number;
    const insertAnswer = db.prepare(
      'INSERT INTO survey_answers (response_id, question_id, score) VALUES (?, ?, ?)'
    );

    for (const [questionId, score] of Object.entries(responses)) {
      insertAnswer.run(responseId, questionId, Number(score));
    }
  });

  tx();
  res.json({ success: true, message: 'Thank you! Your survey responses have been submitted securely and anonymously.' });
});

// GET /api/surveys/campaigns/:id/results - aggregate survey results
router.get('/campaigns/:id/results', requireManager, (req: Request, res: Response) => {
  try {
    const results = getCampaignResults(Number(req.params.id));
    res.json(results);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Failed to retrieve survey results' });
  }
});

// GET /api/surveys/campaigns/:id/recommendations - survey recommendations
router.get('/campaigns/:id/recommendations', requireManager, (req: Request, res: Response) => {
  try {
    const recs = generateSurveyRecommendations(Number(req.params.id));
    res.json(recs);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Failed to generate recommendations' });
  }
});

// POST /api/surveys/campaigns/:id/spawn-next - spawn next weekly instance
router.post('/campaigns/:id/spawn-next', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const parent = db.prepare('SELECT * FROM survey_campaigns WHERE id = ?').get(req.params.id) as any;
  if (!parent) return res.status(404).json({ error: 'Parent campaign not found' });

  // Calculate next start and end dates (+7 days)
  const [sy, sm, sd] = parent.start_date.split('-').map(Number);
  const nextStart = new Date(Date.UTC(sy, sm - 1, sd + 7)).toISOString().slice(0, 10);
  const [ey, em, ed] = parent.end_date.split('-').map(Number);
  const nextEnd = new Date(Date.UTC(ey, em - 1, ed + 7)).toISOString().slice(0, 10);

  const nextTitle = `${parent.title.replace(/\s*\(Week \d+\)/, '')} (Week)`;

  const result = db.prepare(`
    INSERT INTO survey_campaigns (
      template_id, site_id, title, start_date, end_date,
      anonymized, min_group_size, status, recurrence,
      schedule_day_of_week, target_roles, parent_campaign_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `).run(
    parent.template_id,
    parent.site_id,
    nextTitle,
    nextStart,
    nextEnd,
    parent.anonymized,
    parent.min_group_size,
    parent.recurrence,
    parent.schedule_day_of_week,
    parent.target_roles,
    parent.id
  );

  const spawned = db.prepare(`
    SELECT c.*, t.instrument, t.name as template_name
    FROM survey_campaigns c
    JOIN survey_templates t ON c.template_id = t.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(spawned);
});

export default router;

