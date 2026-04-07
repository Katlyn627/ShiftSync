/**
 * /api/surveys — Burnout Survey Module
 *
 * Administers validated burnout instruments (CBI, OLBI, BAT) and brief
 * mediator questions (schedule control, sleep interference). Privacy is
 * enforced via aggregation thresholds: individual responses are never
 * exposed to managers unless the employee consents; only group-level
 * aggregates above the minimum group-size threshold are returned.
 *
 * Extended features:
 *  - Weekly recurrence: campaigns can be set to auto-spawn the next week's
 *    instance when the previous one closes (recurrence='weekly').
 *  - Role-targeted questions: campaigns can include job-title-specific bonus
 *    questions captured at creation via target_roles.
 *  - Department/role breakdowns in results (privacy-threshold enforced per segment).
 *  - Recommended managerial actions derived from subscale scores.
 *
 * Purpose limitation: survey results are used only for schedule quality
 * improvement, not for performance management or punitive decisions.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';
import { logAudit } from './audit';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function interpretScore(subscale: string, avgScore: number, maxScale: number): string {
  const pct = (avgScore - 1) / (maxScale - 1); // normalize 0-1
  if (subscale.includes('mediator_schedule_control')) {
    if (pct >= 0.6) return 'adequate_control';
    if (pct >= 0.4) return 'moderate_control';
    return 'low_control_risk';
  }
  if (subscale.includes('mediator_sleep')) {
    if (pct <= 0.3) return 'low_sleep_interference';
    if (pct <= 0.6) return 'moderate_sleep_interference';
    return 'high_sleep_interference_risk';
  }
  if (pct <= 0.3) return 'low';
  if (pct <= 0.6) return 'moderate';
  return 'high';
}

/** Aggregate a set of response rows into per-subscale results */
function aggregateSubscales(
  responses: { responses: string }[],
  questions: any[]
): Array<{ subscale: string; avg_score: number | null; item_count: number; interpretation: string; pct_high: number }> {
  const acc: Record<string, { sum: number; count: number; reversed_sum: number; reversed_count: number; high: number; total: number }> = {};

  for (const r of responses) {
    let parsed: Record<string, number> = {};
    try { parsed = JSON.parse(r.responses); } catch { continue; }
    for (const q of questions) {
      if (!acc[q.subscale]) acc[q.subscale] = { sum: 0, count: 0, reversed_sum: 0, reversed_count: 0, high: 0, total: 0 };
      const score = parsed[q.id];
      if (score !== undefined && !isNaN(score)) {
        const effective = q.reversed ? (q.scale + 1) - score : score;
        if (q.reversed) {
          acc[q.subscale].reversed_sum += effective;
          acc[q.subscale].reversed_count++;
        } else {
          acc[q.subscale].sum += effective;
          acc[q.subscale].count++;
        }
        acc[q.subscale].total++;
        // Count "high burnout" responses: score >= 4 out of 5 (or >= 3 out of 4)
        const threshold = q.scale >= 5 ? 4 : 3;
        if (effective >= threshold) acc[q.subscale].high++;
      }
    }
  }

  return Object.entries(acc).map(([subscale, a]) => {
    const totalItems = a.count + a.reversed_count;
    const avgScore = totalItems > 0 ? (a.sum + a.reversed_sum) / totalItems : null;
    const pctHigh = a.total > 0 ? Math.round((a.high / a.total) * 100) : 0;
    const maxScale = questions.find(q => q.subscale === subscale)?.scale ?? 5;
    return {
      subscale,
      avg_score: avgScore !== null ? Math.round(avgScore * 100) / 100 : null,
      item_count: totalItems,
      interpretation: avgScore !== null ? interpretScore(subscale, avgScore, maxScale) : 'insufficient_data',
      pct_high: pctHigh,
    };
  });
}

/**
 * Derive actionable manager recommendations from subscale results.
 * Returns an array of { priority, category, action } objects.
 */
function buildRecommendations(
  subscaleResults: Array<{ subscale: string; interpretation: string; avg_score: number | null }>
): Array<{ priority: 'high' | 'medium' | 'low'; category: string; action: string }> {
  const recs: Array<{ priority: 'high' | 'medium' | 'low'; category: string; action: string }> = [];

  for (const sr of subscaleResults) {
    const { subscale, interpretation, avg_score } = sr;
    if (avg_score === null) continue;

    // Schedule control
    if (subscale.includes('mediator_schedule_control')) {
      if (interpretation === 'low_control_risk') {
        recs.push({ priority: 'high', category: 'Schedule Autonomy', action: 'Introduce self-scheduling windows or shift-swap capabilities so employees can influence their own schedules. Even small amounts of autonomy significantly reduce burnout risk.' });
      } else if (interpretation === 'moderate_control') {
        recs.push({ priority: 'medium', category: 'Schedule Autonomy', action: 'Expand shift-swap and open-shift pick-up options. Survey employees about preferred schedule patterns and incorporate preferences where operationally feasible.' });
      }
    }

    // Sleep interference
    if (subscale.includes('mediator_sleep')) {
      if (interpretation === 'high_sleep_interference_risk') {
        recs.push({ priority: 'high', category: 'Shift Design', action: 'Eliminate clopening shifts (closing then early-opening) for individual employees. Enforce at least 10-hour rest windows between shifts. Reduce late-night/early-morning shift pairing.' });
      } else if (interpretation === 'moderate_sleep_interference') {
        recs.push({ priority: 'medium', category: 'Shift Design', action: 'Audit the schedule for back-to-back late and early shifts. Offer fixed shift blocks to reduce circadian disruption, especially for FOH and kitchen staff.' });
      }
    }

    // Personal / exhaustion subscales
    if (['personal', 'exhaustion'].includes(subscale)) {
      if (interpretation === 'high') {
        recs.push({ priority: 'high', category: 'Workload', action: 'Review weekly hours caps and overtime patterns. Ensure mandatory rest days are enforced. Consider rotating high-intensity roles (e.g., expo, brunch lead) to spread physical load. Check for employees regularly working above their contracted hours.' });
      } else if (interpretation === 'moderate') {
        recs.push({ priority: 'medium', category: 'Workload', action: 'Monitor weekly hours trends for individuals above 38 h/week. Proactively offer voluntary time off during slower periods to reduce cumulative fatigue.' });
      }
    }

    // Work-related burnout / disengagement
    if (['work', 'disengagement', 'distance'].includes(subscale)) {
      if (interpretation === 'high') {
        recs.push({ priority: 'high', category: 'Engagement & Meaning', action: 'Hold brief team check-ins to understand what aspects of work feel meaningless or frustrating. Review task variety, autonomy in job duties, and recognition practices. Explore micro-incentives for revenue-impacting roles (servers, bartenders).' });
      } else if (interpretation === 'moderate') {
        recs.push({ priority: 'medium', category: 'Engagement & Meaning', action: 'Introduce role rotation or cross-training to maintain novelty. Acknowledge individual contributions in team briefings. Ensure employees understand how their role affects overall revenue and guest experience.' });
      }
    }

    // Cognitive impairment
    if (subscale === 'cognitive') {
      if (interpretation === 'high') {
        recs.push({ priority: 'high', category: 'Mental Recovery', action: 'Reduce back-to-back peak-service shifts. Consider mandatory breaks during long shifts. Where legally required, ensure meal and rest breaks are respected. Evaluate shift length for roles with high cognitive load (management, bookkeeping, customer-facing leads).' });
      }
    }
  }

  // Deduplicate by category keeping highest priority
  const seen = new Map<string, typeof recs[0]>();
  for (const r of recs) {
    const existing = seen.get(r.category);
    if (!existing || (r.priority === 'high' && existing.priority !== 'high')) {
      seen.set(r.category, r);
    }
  }

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...seen.values()].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * Compute the next ISO date (YYYY-MM-DD) falling on the given day-of-week
 * after the given base date. Always uses only the date portion (first 10 chars)
 * to avoid issues if the input already contains a time component.
 */
function nextWeekDate(baseDateStr: string, dayOfWeek: number): string {
  const dateOnly = (baseDateStr || '').slice(0, 10);
  const base = new Date(dateOnly + 'T12:00:00Z');
  base.setUTCDate(base.getUTCDate() + 7);
  // Adjust to target DOW within that week
  const diff = (dayOfWeek - base.getUTCDay() + 7) % 7;
  base.setUTCDate(base.getUTCDate() + diff);
  return base.toISOString().slice(0, 10);
}

// ── Routes ───────────────────────────────────────────────────────────────────

/** GET /api/surveys/templates — list available survey instruments */
router.get('/templates', requireAuth, (_req: Request, res: Response) => {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM burnout_survey_templates WHERE active = 1 ORDER BY instrument').all();
  res.json(templates);
});

/** GET /api/surveys/campaigns — list active/closed campaigns */
router.get('/campaigns', requireAuth, (req: Request, res: Response) => {
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
router.post('/campaigns', requireManager, (req: Request, res: Response) => {
  const {
    template_id, site_id, title, start_date, end_date, anonymized, min_group_size,
    recurrence, schedule_day_of_week, target_roles,
  } = req.body;
  if (!template_id || !title || !start_date || !end_date) {
    return res.status(400).json({ error: 'template_id, title, start_date, and end_date are required' });
  }
  const db = getDb();
  const template = db.prepare('SELECT * FROM burnout_survey_templates WHERE id = ?').get(template_id);
  if (!template) return res.status(404).json({ error: 'Survey template not found' });

  const effectiveSiteId = site_id ?? req.user?.siteId ?? null;
  const effectiveRecurrence = recurrence === 'weekly' ? 'weekly' : 'none';
  // For weekly campaigns, compute the first next_send_date (one week after end_date).
  // Slice to 10 chars to safely handle any time component that may be in the input.
  const startDateOnly = (start_date || '').slice(0, 10);
  const nextSend = effectiveRecurrence === 'weekly' && end_date
    ? nextWeekDate(end_date, schedule_day_of_week ?? new Date(startDateOnly + 'T12:00:00Z').getUTCDay())
    : null;

  const result = db.prepare(`
    INSERT INTO burnout_survey_campaigns
      (template_id, site_id, title, start_date, end_date, anonymized, min_group_size,
       recurrence, schedule_day_of_week, next_send_date, target_roles)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    template_id, effectiveSiteId, title, start_date, end_date,
    anonymized !== false ? 1 : 0,
    min_group_size ?? 5,
    effectiveRecurrence,
    schedule_day_of_week ?? null,
    nextSend,
    JSON.stringify(Array.isArray(target_roles) ? target_roles : []),
  );

  logAudit({
    action: 'survey_campaign_created',
    entity_type: 'survey_campaign',
    entity_id: result.lastInsertRowid as number,
    user_id: req.user?.userId,
    details: { template_id, title, site_id: effectiveSiteId, recurrence: effectiveRecurrence },
  });

  const campaign = db.prepare('SELECT * FROM burnout_survey_campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(campaign);
});

/** GET /api/surveys/campaigns/:id — campaign details + my response status */
router.get('/campaigns/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const campaign = db.prepare(`
    SELECT sc.*, bst.instrument, bst.name as template_name, bst.description, bst.questions
    FROM burnout_survey_campaigns sc
    JOIN burnout_survey_templates bst ON sc.template_id = bst.id
    WHERE sc.id = ?
  `).get(req.params.id) as any;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  // Append job-title-specific bonus questions when the employee's role is targeted
  const employeeId = req.user?.employeeId;
  let questions = JSON.parse(campaign.questions || '[]');

  if (employeeId) {
    const emp = db.prepare('SELECT role_title, department FROM employees WHERE id = ?').get(employeeId) as any;
    if (emp) {
      const targetRoles: string[] = JSON.parse(campaign.target_roles || '[]');
      const isTargeted = targetRoles.length === 0 || targetRoles.some(
        r => r.toLowerCase() === emp.role_title?.toLowerCase() || r.toLowerCase() === emp.department?.toLowerCase()
      );
      if (isTargeted && emp.role_title) {
        questions = [...questions, ...getRoleSpecificQuestions(emp.role_title, emp.department)];
      }
    }
  }

  const myResponse = employeeId
    ? db.prepare('SELECT submitted_at FROM burnout_survey_responses WHERE campaign_id = ? AND employee_id = ?').get(req.params.id, employeeId)
    : null;

  res.json({
    ...campaign,
    questions: JSON.stringify(questions),
    already_responded: !!myResponse,
    responded_at: (myResponse as any)?.submitted_at ?? null,
  });
});

/** POST /api/surveys/campaigns/:id/respond — employee submits survey responses */
router.post('/campaigns/:id/respond', requireAuth, (req: Request, res: Response) => {
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

  // Capture department/role_title at submission time for group analytics (denormalized)
  const emp = db.prepare('SELECT department, role_title FROM employees WHERE id = ?').get(employeeId) as any;
  const department = emp?.department ?? '';
  const roleTitle = emp?.role_title ?? '';

  db.prepare(`
    INSERT INTO burnout_survey_responses (campaign_id, employee_id, responses, department, role_title)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, employeeId, JSON.stringify(responses), department, roleTitle);

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
 * Breakdown by department and job title is included when each segment meets
 * the minimum group size threshold.
 */
router.get('/campaigns/:id/results', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const campaign = db.prepare(`
    SELECT sc.*, bst.instrument, bst.questions
    FROM burnout_survey_campaigns sc
    JOIN burnout_survey_templates bst ON sc.template_id = bst.id
    WHERE sc.id = ?
  `).get(req.params.id) as any;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const responses = db.prepare(
    'SELECT responses, department, role_title FROM burnout_survey_responses WHERE campaign_id = ?'
  ).all(req.params.id) as { responses: string; department: string; role_title: string }[];

  const responseCount = responses.length;

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

  const questions: any[] = JSON.parse(campaign.questions || '[]');
  const subscaleResults = aggregateSubscales(responses, questions);

  // Breakdown by department (only segments meeting the threshold)
  const byDept: Record<string, typeof responses> = {};
  for (const r of responses) {
    const key = r.department || 'Unspecified';
    if (!byDept[key]) byDept[key] = [];
    byDept[key].push(r);
  }
  const departmentBreakdowns = Object.entries(byDept)
    .filter(([, rows]) => rows.length >= campaign.min_group_size)
    .map(([dept, rows]) => ({
      segment: dept,
      response_count: rows.length,
      subscale_results: aggregateSubscales(rows, questions),
    }));

  // Breakdown by role_title
  const byRole: Record<string, typeof responses> = {};
  for (const r of responses) {
    const key = r.role_title || 'Unspecified';
    if (!byRole[key]) byRole[key] = [];
    byRole[key].push(r);
  }
  const roleTitleBreakdowns = Object.entries(byRole)
    .filter(([, rows]) => rows.length >= campaign.min_group_size)
    .map(([role, rows]) => ({
      segment: role,
      response_count: rows.length,
      subscale_results: aggregateSubscales(rows, questions),
    }));

  res.json({
    campaign_id: parseInt(req.params.id, 10),
    instrument: campaign.instrument,
    response_count: responseCount,
    min_group_size: campaign.min_group_size,
    results_available: true,
    subscale_results: subscaleResults,
    department_breakdowns: departmentBreakdowns,
    role_title_breakdowns: roleTitleBreakdowns,
    purpose_limitation: 'Survey results are used only for schedule quality improvement. They must not be used for performance management or punitive decisions.',
    data_governance: 'Individual responses are never exposed. Results suppressed below minimum group size to protect privacy.',
  });
});

/**
 * GET /api/surveys/campaigns/:id/recommendations — manager action recommendations
 * Derived from aggregated subscale scores; no individual data exposed.
 */
router.get('/campaigns/:id/recommendations', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const campaign = db.prepare(`
    SELECT sc.*, bst.instrument, bst.questions
    FROM burnout_survey_campaigns sc
    JOIN burnout_survey_templates bst ON sc.template_id = bst.id
    WHERE sc.id = ?
  `).get(req.params.id) as any;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const responses = db.prepare(
    'SELECT responses, department, role_title FROM burnout_survey_responses WHERE campaign_id = ?'
  ).all(req.params.id) as { responses: string; department: string; role_title: string }[];

  if (responses.length < campaign.min_group_size) {
    return res.json({
      campaign_id: parseInt(req.params.id, 10),
      results_available: false,
      recommendations: [],
      message: `Not enough responses to generate recommendations (${responses.length}/${campaign.min_group_size}).`,
    });
  }

  const questions: any[] = JSON.parse(campaign.questions || '[]');
  const subscaleResults = aggregateSubscales(responses, questions);
  const recommendations = buildRecommendations(subscaleResults);

  res.json({
    campaign_id: parseInt(req.params.id, 10),
    results_available: true,
    recommendations,
    purpose_limitation: 'Recommendations are based on group-level trends and are intended to improve working conditions — not to evaluate individuals.',
  });
});

/**
 * POST /api/surveys/campaigns/:id/spawn-next — spawn the next weekly instance
 * Called automatically by the weekly scheduler or manually by a manager.
 */
router.post('/campaigns/:id/spawn-next', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const parent = db.prepare('SELECT * FROM burnout_survey_campaigns WHERE id = ?').get(req.params.id) as any;
  if (!parent) return res.status(404).json({ error: 'Campaign not found' });
  if (parent.recurrence !== 'weekly') return res.status(400).json({ error: 'Campaign is not set to weekly recurrence' });

  const startDate = parent.next_send_date ?? nextWeekDate(parent.end_date, parent.schedule_day_of_week ?? 1);
  const endDate = nextWeekDate(startDate, parent.schedule_day_of_week ?? 1);

  const result = db.prepare(`
    INSERT INTO burnout_survey_campaigns
      (template_id, site_id, title, start_date, end_date, anonymized, min_group_size,
       recurrence, schedule_day_of_week, next_send_date, target_roles, parent_campaign_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parent.template_id, parent.site_id, parent.title,
    startDate, endDate,
    parent.anonymized, parent.min_group_size,
    'weekly', parent.schedule_day_of_week,
    nextWeekDate(endDate, parent.schedule_day_of_week ?? 1),
    parent.target_roles,
    parent.id,
  );

  // Update the parent's next_send_date to the one after this new campaign
  db.prepare('UPDATE burnout_survey_campaigns SET next_send_date = ? WHERE id = ?')
    .run(nextWeekDate(endDate, parent.schedule_day_of_week ?? 1), parent.id);

  logAudit({
    action: 'survey_campaign_spawned',
    entity_type: 'survey_campaign',
    entity_id: result.lastInsertRowid as number,
    user_id: req.user?.userId,
    details: { parent_campaign_id: parent.id, start_date: startDate, end_date: endDate },
  });

  const newCampaign = db.prepare('SELECT * FROM burnout_survey_campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newCampaign);
});

// ── Job-title specific questions ─────────────────────────────────────────────

/**
 * Returns additional role-specific survey questions that get appended to the
 * base instrument for employees whose role/department matches.
 * Uses exact-word matching (split on non-word characters) to avoid false positives
 * (e.g. 'part' matching 'department').
 */
function getRoleSpecificQuestions(roleTitle: string, department: string): any[] {
  const role = (roleTitle || '').toLowerCase();
  const dept = (department || '').toLowerCase();
  const questions: any[] = [];

  // Word-boundary-safe matcher: checks whether any keyword appears as a whole word
  const hasWord = (text: string, keywords: string[]): boolean => {
    const words = text.split(/[\s\-_/,]+/).filter(Boolean);
    return keywords.some(kw => {
      if (kw.includes(' ')) {
        return text.includes(kw);
      }
      return words.includes(kw);
    });
  };

  // Revenue-facing / Front-of-House roles
  const isFOH = hasWord(role, ['server', 'bartender', 'host', 'barista', 'cashier', 'foh'])
    || hasWord(dept, ['server', 'bartender', 'host', 'barista', 'cashier', 'foh', 'front of house']);
  if (isFOH) {
    questions.push(
      { id: 'role_foh_tips', text: 'Do fluctuations in tips/gratuities add stress to your work?', scale: 5, subscale: 'revenue_pressure', role_specific: true },
      { id: 'role_foh_pace', text: 'Do peak service periods leave you feeling overwhelmed or unable to recover?', scale: 5, subscale: 'workload_peaks', role_specific: true },
      { id: 'role_foh_feedback', text: 'Do you receive enough recognition or feedback for your performance during busy periods?', scale: 5, subscale: 'feedback_recognition', reversed: true, role_specific: true },
    );
  }

  // Back-of-House / Kitchen
  const isBOH = hasWord(role, ['cook', 'chef', 'prep', 'dishwasher', 'boh'])
    || hasWord(dept, ['cook', 'chef', 'kitchen', 'prep', 'dishwasher', 'boh', 'back of house'])
    || role.includes('line cook') || dept.includes('kitchen');
  if (isBOH) {
    questions.push(
      { id: 'role_boh_heat', text: 'Does the physical environment (heat, noise, pace) of your kitchen leave you physically drained?', scale: 5, subscale: 'physical_environment', role_specific: true },
      { id: 'role_boh_cover', text: 'Are you frequently asked to cover other positions or pick up extra duties due to understaffing?', scale: 5, subscale: 'workload_peaks', role_specific: true },
      { id: 'role_boh_break', text: 'Do you regularly get adequate breaks during your shifts?', scale: 5, subscale: 'mediator_schedule_control', reversed: true, role_specific: true },
    );
  }

  // Management / Supervisor roles
  const isMgmt = hasWord(role, ['manager', 'supervisor', 'director', 'coordinator'])
    || hasWord(dept, ['manager', 'supervisor', 'director', 'coordinator'])
    || /\blead\b/.test(role);
  if (isMgmt) {
    questions.push(
      { id: 'role_mgmt_admin', text: 'Does administrative overhead (scheduling, reporting, compliance) reduce your ability to support your team?', scale: 5, subscale: 'administrative_burden', role_specific: true },
      { id: 'role_mgmt_revenue', text: 'Do revenue targets or labour-cost pressures create conflict with your ability to schedule fairly?', scale: 5, subscale: 'revenue_pressure', role_specific: true },
      { id: 'role_mgmt_support', text: 'Do you feel adequately supported by upper management when making difficult staffing decisions?', scale: 5, subscale: 'feedback_recognition', reversed: true, role_specific: true },
    );
  }

  // Hourly / part-time roles
  const isHourly = hasWord(role, ['hourly', 'casual', 'seasonal'])
    || /\bpart.time\b/.test(role);
  if (isHourly) {
    questions.push(
      { id: 'role_hourly_hours', text: 'Do you receive enough hours each week to meet your financial needs?', scale: 5, subscale: 'revenue_pressure', reversed: true, role_specific: true },
      { id: 'role_hourly_predict', text: 'Is your schedule predictable enough to plan your personal life?', scale: 5, subscale: 'mediator_schedule_control', reversed: true, role_specific: true },
    );
  }

  return questions;
}

export default router;
