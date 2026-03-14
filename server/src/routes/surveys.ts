/**
 * /api/surveys — Burnout Survey Module
 *
 * Administers validated burnout instruments (CBI, OLBI, BAT) and brief
 * mediator questions (schedule control, sleep interference). Privacy is
 * enforced via aggregation thresholds: individual responses are never
 * exposed to managers unless the employee consents; only group-level
 * aggregates above the minimum group-size threshold are returned.
 *
 * Purpose limitation: survey results are used only for schedule quality
 * improvement, not for performance management or punitive decisions.
 */
import { Router } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { logAudit } from './audit';

const router = Router();

/** GET /api/surveys/templates — list available survey instruments */
router.get('/templates', requireAuth, (_req, res) => {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM burnout_survey_templates WHERE active = 1 ORDER BY instrument').all();
  res.json(templates);
});

/** GET /api/surveys/campaigns — list active/closed campaigns */
router.get('/campaigns', requireAuth, (req, res) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const rows = siteId
    ? db.prepare(`
        SELECT sc.*, bst.instrument, bst.name as template_name,
          (SELECT COUNT(*) FROM burnout_survey_responses bsr WHERE bsr.campaign_id = sc.id) as response_count
        FROM burnout_survey_campaigns sc
        JOIN burnout_survey_templates bst ON sc.template_id = bst.id
        WHERE sc.site_id = ? OR sc.site_id IS NULL
        ORDER BY sc.start_date DESC
      `).all(siteId)
    : db.prepare(`
        SELECT sc.*, bst.instrument, bst.name as template_name,
          (SELECT COUNT(*) FROM burnout_survey_responses bsr WHERE bsr.campaign_id = sc.id) as response_count
        FROM burnout_survey_campaigns sc
        JOIN burnout_survey_templates bst ON sc.template_id = bst.id
        ORDER BY sc.start_date DESC
      `).all();
  res.json(rows);
});

/** POST /api/surveys/campaigns — manager creates a new survey campaign */
router.post('/campaigns', requireManager, (req, res) => {
  const { template_id, site_id, title, start_date, end_date, anonymized, min_group_size } = req.body;
  if (!template_id || !title || !start_date || !end_date) {
    return res.status(400).json({ error: 'template_id, title, start_date, and end_date are required' });
  }
  const db = getDb();
  const template = db.prepare('SELECT * FROM burnout_survey_templates WHERE id = ?').get(template_id);
  if (!template) return res.status(404).json({ error: 'Survey template not found' });

  const effectiveSiteId = site_id ?? req.user?.siteId ?? null;
  const result = db.prepare(`
    INSERT INTO burnout_survey_campaigns (template_id, site_id, title, start_date, end_date, anonymized, min_group_size)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    template_id, effectiveSiteId, title, start_date, end_date,
    anonymized !== false ? 1 : 0,
    min_group_size ?? 5
  );

  logAudit({
    action: 'survey_campaign_created',
    entity_type: 'survey_campaign',
    entity_id: result.lastInsertRowid as number,
    user_id: req.user?.userId,
    details: { template_id, title, site_id: effectiveSiteId },
  });

  const campaign = db.prepare('SELECT * FROM burnout_survey_campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(campaign);
});

/** GET /api/surveys/campaigns/:id — campaign details + my response status */
router.get('/campaigns/:id', requireAuth, (req, res) => {
  const db = getDb();
  const campaign = db.prepare(`
    SELECT sc.*, bst.instrument, bst.name as template_name, bst.description, bst.questions
    FROM burnout_survey_campaigns sc
    JOIN burnout_survey_templates bst ON sc.template_id = bst.id
    WHERE sc.id = ?
  `).get(req.params.id) as any;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const employeeId = req.user?.employeeId;
  const myResponse = employeeId
    ? db.prepare('SELECT submitted_at FROM burnout_survey_responses WHERE campaign_id = ? AND employee_id = ?').get(req.params.id, employeeId)
    : null;

  res.json({ ...campaign, already_responded: !!myResponse, responded_at: (myResponse as any)?.submitted_at ?? null });
});

/** POST /api/surveys/campaigns/:id/respond — employee submits survey responses */
router.post('/campaigns/:id/respond', requireAuth, (req, res) => {
  const { responses } = req.body;
  if (!responses || typeof responses !== 'object') {
    return res.status(400).json({ error: 'responses object is required' });
  }

  const db = getDb();
  const campaign = db.prepare('SELECT * FROM burnout_survey_campaigns WHERE id = ?').get(req.params.id) as any;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'active') {
    return res.status(400).json({ error: 'This survey campaign is no longer active' });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (today < campaign.start_date || today > campaign.end_date) {
    return res.status(400).json({ error: 'This survey is outside its active window' });
  }

  const employeeId = req.user?.employeeId;
  if (!employeeId) return res.status(403).json({ error: 'Only employees can respond to surveys' });

  const existing = db.prepare('SELECT id FROM burnout_survey_responses WHERE campaign_id = ? AND employee_id = ?').get(req.params.id, employeeId);
  if (existing) return res.status(409).json({ error: 'You have already responded to this survey' });

  db.prepare(`
    INSERT INTO burnout_survey_responses (campaign_id, employee_id, responses)
    VALUES (?, ?, ?)
  `).run(req.params.id, employeeId, JSON.stringify(responses));

  logAudit({
    action: 'survey_response_submitted',
    entity_type: 'survey_campaign',
    entity_id: parseInt(req.params.id, 10),
    user_id: req.user?.userId,
    details: { campaign_id: parseInt(req.params.id, 10) },
  });

  res.status(201).json({ success: true, message: 'Response recorded. Thank you for your participation.' });
});

/**
 * GET /api/surveys/campaigns/:id/results — aggregated results (manager only)
 *
 * Privacy guarantee: individual responses are never exposed. Results are
 * only returned if response_count >= min_group_size (default 5). Scores
 * are averaged per subscale across all respondents.
 *
 * Purpose limitation notice is included in the response.
 */
router.get('/campaigns/:id/results', requireManager, (req, res) => {
  const db = getDb();
  const campaign = db.prepare(`
    SELECT sc.*, bst.instrument, bst.questions
    FROM burnout_survey_campaigns sc
    JOIN burnout_survey_templates bst ON sc.template_id = bst.id
    WHERE sc.id = ?
  `).get(req.params.id) as any;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const responses = db.prepare(
    'SELECT responses FROM burnout_survey_responses WHERE campaign_id = ?'
  ).all(req.params.id) as { responses: string }[];

  const responseCount = responses.length;

  // Enforce privacy threshold
  if (responseCount < campaign.min_group_size) {
    return res.json({
      campaign_id: parseInt(req.params.id, 10),
      response_count: responseCount,
      min_group_size: campaign.min_group_size,
      results_available: false,
      message: `Results are suppressed until at least ${campaign.min_group_size} responses are collected (currently ${responseCount}). This protects individual privacy.`,
      purpose_limitation: 'Survey results are used only for schedule quality improvement. They must not be used for performance management or punitive decisions.',
    });
  }

  // Aggregate by subscale
  const questions: any[] = JSON.parse(campaign.questions || '[]');
  const subscaleAccumulators: Record<string, { sum: number; count: number; reversed_sum: number; reversed_count: number }> = {};

  for (const r of responses) {
    let parsed: Record<string, number> = {};
    try { parsed = JSON.parse(r.responses); } catch { continue; }
    for (const q of questions) {
      if (!subscaleAccumulators[q.subscale]) {
        subscaleAccumulators[q.subscale] = { sum: 0, count: 0, reversed_sum: 0, reversed_count: 0 };
      }
      const score = parsed[q.id];
      if (score !== undefined && !isNaN(score)) {
        if (q.reversed) {
          // Reverse-scored items: max_scale + 1 - score
          subscaleAccumulators[q.subscale].reversed_sum += (q.scale + 1) - score;
          subscaleAccumulators[q.subscale].reversed_count++;
        } else {
          subscaleAccumulators[q.subscale].sum += score;
          subscaleAccumulators[q.subscale].count++;
        }
      }
    }
  }

  const subscaleResults = Object.entries(subscaleAccumulators).map(([subscale, acc]) => {
    const totalItems = acc.count + acc.reversed_count;
    const avgScore = totalItems > 0
      ? (acc.sum + acc.reversed_sum) / totalItems
      : null;
    return {
      subscale,
      avg_score: avgScore !== null ? Math.round(avgScore * 100) / 100 : null,
      item_count: totalItems,
      interpretation: avgScore !== null ? interpretScore(subscale, avgScore, questions.find(q => q.subscale === subscale)?.scale ?? 5) : 'insufficient_data',
    };
  });

  res.json({
    campaign_id: parseInt(req.params.id, 10),
    instrument: campaign.instrument,
    response_count: responseCount,
    min_group_size: campaign.min_group_size,
    results_available: true,
    subscale_results: subscaleResults,
    purpose_limitation: 'Survey results are used only for schedule quality improvement. They must not be used for performance management or punitive decisions.',
    data_governance: 'Individual responses are never exposed. Results suppressed below minimum group size to protect privacy.',
  });
});

function interpretScore(subscale: string, avgScore: number, maxScale: number): string {
  const pct = (avgScore - 1) / (maxScale - 1); // normalize 0-1
  if (subscale.includes('mediator_schedule_control')) {
    // Higher = more control = better
    if (pct >= 0.6) return 'adequate_control';
    if (pct >= 0.4) return 'moderate_control';
    return 'low_control_risk';
  }
  if (subscale.includes('mediator_sleep')) {
    // Higher = more sleep interference = worse
    if (pct <= 0.3) return 'low_sleep_interference';
    if (pct <= 0.6) return 'moderate_sleep_interference';
    return 'high_sleep_interference_risk';
  }
  // Burnout subscales: higher = more burnout = worse
  if (pct <= 0.3) return 'low';
  if (pct <= 0.6) return 'moderate';
  return 'high';
}

export default router;
