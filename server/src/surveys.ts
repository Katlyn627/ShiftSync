import { getDb } from './db';
import {
  SurveyTemplate,
  SurveyQuestion,
  SurveyCampaign,
  SurveyResults,
  SurveySubscaleResult,
  SurveyBreakdownSegment,
  SurveyRecommendations,
  SurveyRecommendation,
} from './types';

export const VALIDATED_SURVEY_INSTRUMENTS: Array<{
  instrument: string;
  name: string;
  description: string;
  questions: SurveyQuestion[];
}> = [
  {
    instrument: 'CBI',
    name: 'Copenhagen Burnout Inventory',
    description: 'Validated tool assessing personal, work-related, and client/beneficiary-related burnout.',
    questions: [
      { id: 'cbi_1', text: 'How often do you feel tired and exhausted?', scale: 5, subscale: 'personal_burnout' },
      { id: 'cbi_2', text: 'How often are you physically exhausted at the end of a workday?', scale: 5, subscale: 'personal_burnout' },
      { id: 'cbi_3', text: 'How often do you feel emotionally drained by your work?', scale: 5, subscale: 'work_burnout' },
      { id: 'cbi_4', text: 'Does your work feel frustrating or overwhelming?', scale: 5, subscale: 'work_burnout' },
      { id: 'cbi_5', text: 'Do you feel you give more to your beneficiaries/clients than you get back?', scale: 5, subscale: 'client_burnout' },
      { id: 'cbi_6', text: 'Do you find it hard to find energy for beneficiaries or team members?', scale: 5, subscale: 'client_burnout' },
      { id: 'cbi_7', text: 'Are field deployments or direct service hours taxing your recovery?', scale: 5, subscale: 'work_burnout', role_specific: true },
    ],
  },
  {
    instrument: 'BAT',
    name: 'Burnout Assessment Tool',
    description: 'Comprehensive 4-dimension instrument evaluating exhaustion, mental distance, cognitive impairment, and emotional control.',
    questions: [
      { id: 'bat_1', text: 'At work, I feel mentally exhausted and struggle to recharge.', scale: 5, subscale: 'exhaustion' },
      { id: 'bat_2', text: 'Everything I do at work requires a great deal of effort.', scale: 5, subscale: 'exhaustion' },
      { id: 'bat_3', text: 'I feel a strong sense of detachment or indifference towards my work.', scale: 5, subscale: 'mental_distance' },
      { id: 'bat_4', text: 'I struggle to concentrate or make decisions during high-stress hours.', scale: 5, subscale: 'cognitive_impairment' },
      { id: 'bat_5', text: 'I feel unable to control my emotions when unexpected changes occur.', scale: 5, subscale: 'emotional_impairment' },
      { id: 'bat_6', text: 'On-call and emergency shift turnarounds interfere with my sleep.', scale: 5, subscale: 'exhaustion', role_specific: true },
    ],
  },
  {
    instrument: 'OLBI',
    name: 'Oldenburg Burnout Inventory',
    description: 'Measures two central dimensions of burnout: exhaustion and disengagement from work.',
    questions: [
      { id: 'olbi_1', text: 'There are days when I feel tired before I even arrive at work.', scale: 4, subscale: 'exhaustion' },
      { id: 'olbi_2', text: 'After work, I usually have enough energy for my leisure activities.', scale: 4, subscale: 'exhaustion', reversed: true },
      { id: 'olbi_3', text: 'I feel more and more engaged with my organizational mission.', scale: 4, subscale: 'disengagement', reversed: true },
      { id: 'olbi_4', text: 'I sometimes feel cynical about the value and impact of my work.', scale: 4, subscale: 'disengagement' },
      { id: 'olbi_5', text: 'The workload and pace in my department feel sustainable.', scale: 4, subscale: 'exhaustion', reversed: true },
    ],
  },
  {
    instrument: 'WHO-5',
    name: 'WHO-5 Well-Being Index',
    description: 'World Health Organization psychiatric wellbeing and vitality benchmark.',
    questions: [
      { id: 'who_1', text: 'I have felt cheerful and in good spirits.', scale: 6, subscale: 'general_wellbeing', reversed: true },
      { id: 'who_2', text: 'I have felt calm and relaxed between shifts.', scale: 6, subscale: 'general_wellbeing', reversed: true },
      { id: 'who_3', text: 'I have felt active and vigorous.', scale: 6, subscale: 'general_wellbeing', reversed: true },
      { id: 'who_4', text: 'I woke up feeling fresh and rested.', scale: 6, subscale: 'general_wellbeing', reversed: true },
      { id: 'who_5', text: 'My daily life has been filled with things that interest me.', scale: 6, subscale: 'general_wellbeing', reversed: true },
    ],
  },
  {
    instrument: 'GII-HUMANITARIAN',
    name: 'Humanitarian Mission & Field Operations Assessment',
    description: 'Tailored for relief aid, child protection, community health, and volunteer coordination.',
    questions: [
      { id: 'hum_1', text: 'I feel emotionally burdened by the trauma or hardship of the families we serve.', scale: 5, subscale: 'secondary_trauma' },
      { id: 'hum_2', text: 'I have adequate autonomy and control over my daily schedule and duties.', scale: 5, subscale: 'work_control', reversed: true },
      { id: 'hum_3', text: 'Irregular shift times or emergency calls disrupt my sleep cycle.', scale: 5, subscale: 'sleep_interference' },
      { id: 'hum_4', text: 'Volunteer and participant ratios in our programs feel safe and manageable.', scale: 5, subscale: 'work_control', reversed: true },
      { id: 'hum_5', text: 'I feel supported by management after handling critical field or crisis incidents.', scale: 5, subscale: 'secondary_trauma', reversed: true },
    ],
  },
];

export function seedSurveyTemplates(): void {
  const db = getDb();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO survey_templates (instrument, name, description, questions, active)
    VALUES (?, ?, ?, ?, 1)
  `);

  const tx = db.transaction(() => {
    for (const t of VALIDATED_SURVEY_INSTRUMENTS) {
      const existing = db.prepare('SELECT id FROM survey_templates WHERE instrument = ?').get(t.instrument);
      if (!existing) {
        insertStmt.run(t.instrument, t.name, t.description, JSON.stringify(t.questions));
      }
    }
  });
  tx();
}

function interpretSubscaleScore(subscale: string, avgScore: number | null): string {
  if (avgScore === null) return 'insufficient_data';
  if (subscale === 'work_control') {
    if (avgScore >= 3.8) return 'adequate_control';
    if (avgScore >= 2.8) return 'moderate_control';
    return 'low_control_risk';
  }
  if (subscale === 'sleep_interference') {
    if (avgScore <= 2.2) return 'low_sleep_interference';
    if (avgScore <= 3.4) return 'moderate_sleep_interference';
    return 'high_sleep_interference_risk';
  }
  if (avgScore <= 2.3) return 'low';
  if (avgScore <= 3.5) return 'moderate';
  return 'high';
}

export function computeSubscaleResults(
  questions: SurveyQuestion[],
  answers: Array<{ question_id: string; score: number }>
): SurveySubscaleResult[] {
  const qMap = new Map<string, SurveyQuestion>(questions.map(q => [q.id, q]));
  const subscaleScores = new Map<string, number[]>();

  for (const ans of answers) {
    const q = qMap.get(ans.question_id);
    if (!q) continue;
    let normalized = ans.score;
    if (q.reversed) {
      // Reversing score: (scale + 1) - score
      normalized = (q.scale + 1) - ans.score;
    }
    if (!subscaleScores.has(q.subscale)) subscaleScores.set(q.subscale, []);
    subscaleScores.get(q.subscale)!.push(normalized);
  }

  const results: SurveySubscaleResult[] = [];
  subscaleScores.forEach((scores, subscale) => {
    const count = scores.length;
    const avg = count > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / count) * 100) / 100 : null;
    const highScores = scores.filter(s => s >= 4).length;
    const pctHigh = count > 0 ? Math.round((highScores / count) * 100) : 0;
    const interpretation = interpretSubscaleScore(subscale, avg);

    results.push({
      subscale,
      avg_score: avg,
      item_count: count,
      interpretation,
      pct_high: pctHigh,
    });
  });

  return results.sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0));
}

export function getCampaignResults(campaignId: number): SurveyResults {
  const db = getDb();
  const campaign = db.prepare(`
    SELECT c.*, t.instrument, t.questions as template_questions
    FROM survey_campaigns c
    JOIN survey_templates t ON c.template_id = t.id
    WHERE c.id = ?
  `).get(campaignId) as any;

  if (!campaign) throw new Error('Survey campaign not found');

  const questions: SurveyQuestion[] = JSON.parse(campaign.questions || campaign.template_questions || '[]');
  const responses = db.prepare('SELECT * FROM survey_responses WHERE campaign_id = ?').all(campaignId) as any[];
  const responseCount = responses.length;
  const minGroupSize = campaign.min_group_size || 5;

  if (responseCount < minGroupSize) {
    return {
      campaign_id: campaignId,
      instrument: campaign.instrument,
      response_count: responseCount,
      min_group_size: minGroupSize,
      results_available: false,
      message: `Results are suppressed to preserve participant anonymity. At least ${minGroupSize} responses are required before aggregated scores can be revealed (currently received: ${responseCount}).`,
      purpose_limitation: 'Data is collected exclusively for workload balancing, fatigue reduction, and schedule improvement.',
      data_governance: 'GDPR / WHO Occupational Health privacy standards active. Individual responses are confidential.',
    };
  }

  const allAnswers = db.prepare(`
    SELECT a.question_id, a.score, r.department, r.role_title
    FROM survey_answers a
    JOIN survey_responses r ON a.response_id = r.id
    WHERE r.campaign_id = ?
  `).all(campaignId) as Array<{ question_id: string; score: number; department?: string; role_title?: string }>;

  // Overall subscale results
  const subscaleResults = computeSubscaleResults(questions, allAnswers);

  // Department breakdowns (only for departments meeting min_group_size)
  const byDept = new Map<string, typeof allAnswers>();
  const deptCounts = new Map<string, number>();
  responses.forEach(r => {
    const dept = (r.department || 'General').trim();
    deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
  });

  allAnswers.forEach(ans => {
    const dept = (ans.department || 'General').trim();
    if (!byDept.has(dept)) byDept.set(dept, []);
    byDept.get(dept)!.push(ans);
  });

  const departmentBreakdowns: SurveyBreakdownSegment[] = [];
  byDept.forEach((deptAnswers, dept) => {
    const count = deptCounts.get(dept) || 0;
    if (count >= minGroupSize) {
      departmentBreakdowns.push({
        segment: dept,
        response_count: count,
        subscale_results: computeSubscaleResults(questions, deptAnswers),
      });
    }
  });

  // Role breakdowns
  const byRole = new Map<string, typeof allAnswers>();
  const roleCounts = new Map<string, number>();
  responses.forEach(r => {
    const role = (r.role_title || 'General').trim();
    roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
  });

  allAnswers.forEach(ans => {
    const role = (ans.role_title || 'General').trim();
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(ans);
  });

  const roleBreakdowns: SurveyBreakdownSegment[] = [];
  byRole.forEach((roleAnswers, role) => {
    const count = roleCounts.get(role) || 0;
    if (count >= minGroupSize) {
      roleBreakdowns.push({
        segment: role,
        response_count: count,
        subscale_results: computeSubscaleResults(questions, roleAnswers),
      });
    }
  });

  return {
    campaign_id: campaignId,
    instrument: campaign.instrument,
    response_count: responseCount,
    min_group_size: minGroupSize,
    results_available: true,
    subscale_results: subscaleResults,
    department_breakdowns: departmentBreakdowns,
    role_title_breakdowns: roleBreakdowns,
    purpose_limitation: 'Results are utilized strictly to enhance working conditions, rest turnarounds, and equitable staffing.',
    data_governance: 'Anonymous aggregation with strict k-anonymity (min group size: 5).',
  };
}

export function generateSurveyRecommendations(campaignId: number): SurveyRecommendations {
  const results = getCampaignResults(campaignId);
  if (!results.results_available || !results.subscale_results) {
    return {
      campaign_id: campaignId,
      results_available: false,
      recommendations: [],
      message: results.message,
      purpose_limitation: results.purpose_limitation,
    };
  }

  const recommendations: SurveyRecommendation[] = [];

  for (const sr of results.subscale_results) {
    if (sr.interpretation === 'high' || sr.interpretation === 'high_sleep_interference_risk' || sr.interpretation === 'low_control_risk') {
      if (['exhaustion', 'personal_burnout', 'work_burnout'].includes(sr.subscale)) {
        recommendations.push({
          priority: 'high',
          category: 'Rest & Recovery',
          action: 'Staff are reporting significant exhaustion. Increase minimum rest turnaround from 10h to 12h, cap consecutive work days at 5, and review weekly hours caps.',
        });
      }
      if (['client_burnout', 'secondary_trauma', 'emotional_impairment'].includes(sr.subscale)) {
        recommendations.push({
          priority: 'high',
          category: 'Trauma & Mission Support',
          action: 'Elevated emotional/secondary trauma strain detected. Introduce rotational scheduling between direct beneficiary care and administrative workblocks, and offer peer debriefing.',
        });
      }
      if (['sleep_interference'].includes(sr.subscale)) {
        recommendations.push({
          priority: 'high',
          category: 'Shift Predictability',
          action: 'Unpredictable shift times and emergency on-call turnarounds are disrupting sleep. Publish schedules at least 14 days in advance and limit clopens.',
        });
      }
      if (['work_control', 'mental_distance', 'disengagement'].includes(sr.subscale)) {
        recommendations.push({
          priority: 'medium',
          category: 'Autonomy & Engagement',
          action: 'Staff report low schedule control and distancing. Enable open-shift swaps, allow flexible availability windows, and consult teams before altering draft rotas.',
        });
      }
    } else if (sr.interpretation === 'moderate' || sr.interpretation === 'moderate_sleep_interference' || sr.interpretation === 'moderate_control') {
      recommendations.push({
        priority: 'medium',
        category: 'Proactive Monitoring',
        action: `Moderate elevated scores in ${sr.subscale.replace(/_/g, ' ')}. Track weekly overtime and ensure fair weekend shift rotation across all team members.`,
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      category: 'Maintenance',
      action: 'Overall wellbeing scores are favorable. Maintain current staffing levels and continue regular weekly pulse check-ins.',
    });
  }

  return {
    campaign_id: campaignId,
    results_available: true,
    recommendations,
    purpose_limitation: results.purpose_limitation,
  };
}

