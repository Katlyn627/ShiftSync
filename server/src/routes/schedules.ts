import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { generateSchedule, computeWeeklyStaffingNeeds } from '../scheduler';
import { getLaborCostSummary } from '../laborCost';
import { calculateBurnoutRisks } from '../burnout';
import { getProfitabilityMetrics, getRestaurantSettings } from '../metrics';
import { getScheduleCoverageReport } from '../coverage';
import { getScheduleIntelligence } from '../intelligence';
import { requireManager, requireAuth } from '../middleware/auth';
import { logAudit } from './audit';
import { getEventsForDate, SEASONAL_WINDOWS, getSeasonalMultiplier } from '../events';

const router = Router();

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const schedules = siteId
    ? db.prepare('SELECT * FROM schedules WHERE site_id = ? ORDER BY week_start DESC').all(siteId)
    : db.prepare('SELECT * FROM schedules ORDER BY week_start DESC').all();
  res.json(schedules);
});

router.post('/generate', requireManager, (req: Request, res: Response) => {
  const { week_start, labor_budget } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start is required' });
  try {
    const siteId = req.user?.siteId ?? null;
    const scheduleId = generateSchedule({ weekStart: week_start, laborBudget: labor_budget ?? 5000, siteId });
    const db = getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
    logAudit({
      action: 'schedule_generated',
      entity_type: 'schedule',
      entity_id: scheduleId,
      user_id: req.user?.userId,
      details: { week_start, labor_budget: labor_budget ?? 5000, site_id: siteId },
    });
    res.status(201).json(schedule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Baseline daily revenue by day-of-week offset (Mon=0 … Sun=6) for fallback estimates
// when no real forecast data exists for a week.
const BASELINE_RESTAURANT_REV = [4800, 5400, 6600, 8400, 12000, 14400, 8400];
const BASELINE_HOTEL_REV      = [32000, 38000, 45000, 55000, 62000, 68000, 44000];

// Platform-specific multipliers matching POS sync simulation
const PLATFORM_MULTIPLIERS: Record<string, number> = {
  square: 1.02, toast: 0.98, clover: 1.01, lightspeed: 1.03, revel: 0.99, other: 1.00,
};

/**
 * Returns the Monday (YYYY-MM-DD) of the week that contains `dateStr`.
 */
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun
  const daysBack = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().split('T')[0];
}

/**
 * Returns a preview of the forecast and profitability data that will drive
 * schedule generation for the given week. Call this before auto-generating
 * to show the user what revenue, covers, and metrics the algorithm will use.
 */
router.get('/generate-preview', requireManager, async (req: Request, res: Response) => {
  const { week_start } = req.query;
  if (!week_start || typeof week_start !== 'string') {
    return res.status(400).json({ error: 'week_start query parameter is required' });
  }
  try {
    const db = getDb();
    const siteId = req.user?.siteId ?? null;
    const settings = getRestaurantSettings();

    // Determine site type (restaurant vs hotel) for adaptable metrics
    const siteRow = siteId !== null
      ? (db.prepare('SELECT site_type FROM sites WHERE id = ?').get(siteId) as any)
      : null;
    const siteType: 'restaurant' | 'hotel' = siteRow?.site_type === 'hotel' ? 'hotel' : 'restaurant';

    // Look up the most recently synced POS integration for this site (any time, not just 24 h)
    const posRow = siteId !== null
      ? (db.prepare(
          "SELECT platform_name, display_name, last_synced_at FROM pos_integrations WHERE site_id = ? AND last_sync_status = 'success' AND last_synced_at IS NOT NULL ORDER BY last_synced_at DESC LIMIT 1"
        ).get(siteId) as any)
      : null;

    const platformMultiplier = posRow ? (PLATFORM_MULTIPLIERS[posRow.platform_name] ?? 1.0) : 1.0;
    const baselineRevByOffset = siteType === 'hotel' ? BASELINE_HOTEL_REV : BASELINE_RESTAURANT_REV;
    const avgCheck = siteType === 'hotel' ? 600 : 50;

    // Build week dates
    const startDate = new Date(week_start + 'T00:00:00Z');
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }

    const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Fetch per-day forecasts; fall back to platform-scaled estimates when absent
    const forecastRows = weekDates.map((date, idx) => {
      const row = siteId !== null
        ? (db.prepare('SELECT * FROM forecasts WHERE date = ? AND site_id = ?').get(date, siteId) as any)
        : (db.prepare('SELECT * FROM forecasts WHERE date = ?').get(date) as any);
      const [year, month, day] = date.split('-').map(Number);
      const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

      // Fallback: derive estimated revenue from baseline × platform × seasonal lift
      const seasonalMult = getSeasonalMultiplier(date);
      const dayOffset = idx; // Mon=0 … Sun=6 (week_start is always Monday)
      const estimatedRevenue = Math.round(baselineRevByOffset[dayOffset] * platformMultiplier * seasonalMult);
      const estimatedCovers  = Math.floor(estimatedRevenue / avgCheck);

      return {
        date,
        day_name: DAY_ABBR[dayOfWeek],
        expected_revenue: row?.expected_revenue ?? estimatedRevenue,
        expected_covers:  row?.expected_covers  ?? estimatedCovers,
        has_data:  row !== null && row !== undefined,
        is_estimated: row === null || row === undefined,
        events: getEventsForDate(date),
      };
    });

    const totalExpectedRevenue = forecastRows.reduce((s, f) => s + f.expected_revenue, 0);
    const totalExpectedCovers  = forecastRows.reduce((s, f) => s + f.expected_covers,  0);

    // Compute profitability preview metrics
    const totalServicePeriods = settings.tables * 7 * 2;
    const tableTurnoverRate   = totalServicePeriods > 0 ? totalExpectedCovers / totalServicePeriods : 0;
    const avgCheckPerHead     = totalExpectedCovers > 0 ? totalExpectedRevenue / totalExpectedCovers : 0;
    const estimatedLaborCost  = totalExpectedRevenue * (settings.target_labor_pct / 100);
    const estimatedCogs       = totalExpectedRevenue * (settings.cogs_pct / 100);
    const estimatedPrimeCost  = estimatedLaborCost + estimatedCogs;
    const primeCostPct        = totalExpectedRevenue > 0 ? (estimatedPrimeCost / totalExpectedRevenue) * 100 : 0;
    const totalOperatingHours = settings.operating_hours_per_day * 7;
    const revpash = settings.seats > 0 && totalOperatingHours > 0
      ? totalExpectedRevenue / (settings.seats * totalOperatingHours)
      : 0;

    // Summarise days in this week that have events (for the UI alert panel)
    const upcomingEvents = forecastRows
      .filter(f => f.events.length > 0)
      .map(f => ({ date: f.date, day_name: f.day_name, events: f.events }));

    // ── AI Week Recommendations ──────────────────────────────────────────────
    // Scan the next 12 weeks and surface the top upcoming high-value periods
    // based on seasonal multipliers, helping managers plan staffing proactively.
    const todayMonday = mondayOf(new Date().toISOString().split('T')[0]);
    const weeklyBaselineRevenue = baselineRevByOffset.reduce((s, r) => s + r, 0) * platformMultiplier;
    const aiWeekRecommendations: {
      week_start: string;
      projected_revenue: number;
      rating: 'peak' | 'above_average' | 'average';
      events: string[];
    }[] = [];

    for (let w = 0; w < 12; w++) {
      const wMonday = new Date(todayMonday + 'T00:00:00Z');
      wMonday.setUTCDate(wMonday.getUTCDate() + w * 7);
      const wMondayStr = wMonday.toISOString().split('T')[0];

      // Collect events and peak multiplier for the week
      const weekEventLabels = new Set<string>();
      let peakMult = 1.0;
      for (let d = 0; d < 7; d++) {
        const dDate = new Date(wMonday);
        dDate.setUTCDate(wMonday.getUTCDate() + d);
        const dStr = dDate.toISOString().split('T')[0];
        const mult = getSeasonalMultiplier(dStr);
        if (mult > peakMult) peakMult = mult;
        getEventsForDate(dStr).forEach(ev => weekEventLabels.add(ev));
      }

      const projectedRevenue = Math.round(weeklyBaselineRevenue * peakMult);
      const rating: 'peak' | 'above_average' | 'average' =
        peakMult >= 1.30 ? 'peak' :
        peakMult >= 1.10 ? 'above_average' : 'average';

      // Only surface weeks with at least above-average activity
      if (rating !== 'average') {
        aiWeekRecommendations.push({
          week_start:        wMondayStr,
          projected_revenue: projectedRevenue,
          rating,
          events:            Array.from(weekEventLabels),
        });
      }
    }
    // Keep only the 4 nearest high-value weeks
    aiWeekRecommendations.sort((a, b) => a.week_start.localeCompare(b.week_start));
    const topAiWeeks = aiWeekRecommendations.slice(0, 4);

    res.json({
      week_start,
      site_id:  siteId,
      site_type: siteType,
      forecasts: forecastRows,
      total_expected_revenue:  Math.round(totalExpectedRevenue * 100) / 100,
      total_expected_covers:   totalExpectedCovers,
      avg_check_per_head:      Math.round(avgCheckPerHead * 100) / 100,
      table_turnover_rate:     Math.round(tableTurnoverRate * 10) / 10,
      estimated_labor_cost:    Math.round(estimatedLaborCost * 100) / 100,
      estimated_cogs:          Math.round(estimatedCogs * 100) / 100,
      estimated_prime_cost:    Math.round(estimatedPrimeCost * 100) / 100,
      prime_cost_pct:          Math.round(primeCostPct * 10) / 10,
      revpash:                 Math.round(revpash * 100) / 100,
      settings,
      has_forecast_data:       forecastRows.some(f => f.has_data),
      pos_last_synced:         posRow
        ? { platform: posRow.platform_name as string, display_name: posRow.display_name as string, at: posRow.last_synced_at as string }
        : null,
      upcoming_events:         upcomingEvents,
      ai_week_recommendations: topAiWeeks,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/staffing-suggestions', requireManager, (req: Request, res: Response) => {
  const { week_start } = req.query;
  if (!week_start || typeof week_start !== 'string') {
    return res.status(400).json({ error: 'week_start query parameter is required' });
  }
  try {
    const siteId = req.user?.siteId ?? null;
    const suggestions = computeWeeklyStaffingNeeds(week_start, siteId);
    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

  // Publish-ahead SLA enforcement
  if (status === 'published') {
    const sla = existing.site_id
      ? db.prepare('SELECT advance_days FROM publish_ahead_sla WHERE site_id = ? AND role IS NULL').get(existing.site_id) as any
      : null;
    if (sla) {
      const weekStartDate = new Date(existing.week_start + 'T00:00:00').getTime();
      const now = Date.now();
      const daysUntilStart = (weekStartDate - now) / (24 * 3600 * 1000);
      if (daysUntilStart < sla.advance_days) {
        return res.status(422).json({
          error: `Publish-ahead SLA violation: schedule must be published at least ${sla.advance_days} days before the week starts. Currently ${Math.round(daysUntilStart)} days away.`,
          sla_advance_days: sla.advance_days,
          days_until_start: Math.round(daysUntilStart),
          can_override: true,
        });
      }
    }
  }

  if (status) db.prepare('UPDATE schedules SET status=? WHERE id=?').run(status, req.params.id);
  if (status) {
    logAudit({
      action: `schedule_${status}`,
      entity_type: 'schedule',
      entity_id: parseInt(req.params.id, 10),
      user_id: req.user?.userId,
      details: { previous_status: existing.status, new_status: status },
    });
  }
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
    SELECT s.*, e.name as employee_name, e.role as employee_role, e.hourly_rate
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ? AND s.status != 'cancelled'
    ORDER BY s.date, s.start_time, e.name
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

router.get('/:id/burnout-risks', requireAuth, (req: Request, res: Response) => {
  try {
    const risks = calculateBurnoutRisks(parseInt(req.params.id));
    const isManager = req.user?.isManager;

    if (isManager) {
      // Managers see full individual-level burnout data
      return res.json(risks);
    }

    // Non-managers: only return their own entry (if it exists) plus an anonymised aggregate
    // to prevent re-identification from small group scores.
    const employeeId = req.user?.employeeId;
    const own = risks.find(r => r.employee_id === employeeId) ?? null;

    // Aggregate summary — always safe to expose (no individual identification)
    const summary = {
      total_employees: risks.length,
      high_risk_count: risks.filter(r => r.risk_level === 'high').length,
      medium_risk_count: risks.filter(r => r.risk_level === 'medium').length,
      low_risk_count: risks.filter(r => r.risk_level === 'low').length,
      // Expose averages only; never expose individual non-self scores
      avg_risk_score: risks.length
        ? Math.round(risks.reduce((s, r) => s + r.risk_score, 0) / risks.length)
        : 0,
    };

    return res.json({ own, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/profitability-metrics', requireManager, (req: Request, res: Response) => {
  try {
    const metrics = getProfitabilityMetrics(parseInt(req.params.id));
    res.json(metrics);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/coverage', (req: Request, res: Response) => {
  try {
    const report = getScheduleCoverageReport(parseInt(req.params.id));
    res.json(report);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/intelligence', requireManager, (req: Request, res: Response) => {
  try {
    const intel = getScheduleIntelligence(parseInt(req.params.id));
    res.json(intel);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/instability', requireManager, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as any;
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const allShifts = db.prepare("SELECT * FROM shifts WHERE schedule_id = ?").all(req.params.id) as any[];
    const cancelledShifts = allShifts.filter(s => s.status === 'cancelled');
    const activeShifts = allShifts.filter(s => s.status !== 'cancelled');

    const shiftIds = allShifts.map(s => s.id);
    const changeRequests = shiftIds.length > 0
      ? db.prepare(`SELECT * FROM schedule_change_requests WHERE shift_id IN (${shiftIds.map(() => '?').join(',')})`).all(...shiftIds) as any[]
      : [];

    const lateChanges = changeRequests.filter(cr => {
      if (!cr.original_date) return false;
      const daysBefore = (new Date(cr.original_date).getTime() - new Date(cr.created_at).getTime()) / (24 * 3600 * 1000);
      return daysBefore < 14;
    });

    const callouts = db.prepare(`
      SELECT ce.* FROM callout_events ce JOIN shifts s ON ce.shift_id = s.id WHERE s.schedule_id = ?
    `).all(req.params.id) as any[];

    // Quick returns
    let quickReturns = 0;
    const compRule = db.prepare("SELECT rule_value FROM compliance_rules WHERE jurisdiction = 'default' AND rule_type = 'min_rest_hours'").get() as any;
    const minRest = compRule ? parseFloat(compRule.rule_value) : 10;
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    const byEmp: Record<number, any[]> = {};
    for (const s of activeShifts) {
      if (!byEmp[s.employee_id]) byEmp[s.employee_id] = [];
      byEmp[s.employee_id].push(s);
    }
    for (const empShifts of Object.values(byEmp)) {
      const sorted = [...empShifts].sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]; const curr = sorted[i];
        if (prev.date === curr.date) continue;
        const prevMs = new Date(prev.date + 'T00:00:00').getTime();
        const currMs = new Date(curr.date + 'T00:00:00').getTime();
        if ((currMs - prevMs) / (24 * 3600 * 1000) === 1) {
          const gap = (24 * 60 - toMin(prev.end_time)) + toMin(curr.start_time);
          if (gap < minRest * 60) quickReturns++;
        }
      }
    }

    const sla = schedule.site_id
      ? db.prepare('SELECT advance_days FROM publish_ahead_sla WHERE site_id = ? AND role IS NULL').get(schedule.site_id) as any
      : null;
    const requiredAdvanceDays = sla?.advance_days ?? 14;
    const daysAdvance = (new Date(schedule.week_start + 'T00:00:00').getTime() - new Date(schedule.created_at).getTime()) / (24 * 3600 * 1000);
    const predictabilityPayExposure = daysAdvance < requiredAdvanceDays ? activeShifts.length : lateChanges.length;

    const instabilityScore = Math.min(100, Math.round(
      (cancelledShifts.length / Math.max(1, allShifts.length)) * 30 +
      (quickReturns / Math.max(1, activeShifts.length)) * 25 +
      (callouts.length / Math.max(1, activeShifts.length)) * 25 +
      (lateChanges.length / Math.max(1, allShifts.length)) * 20
    ));

    res.json({
      schedule_id: parseInt(req.params.id, 10),
      week_start: schedule.week_start,
      total_shifts: allShifts.length,
      active_shifts: activeShifts.length,
      cancelled_shifts: cancelledShifts.length,
      cancellation_rate_pct: allShifts.length > 0 ? Math.round((cancelledShifts.length / allShifts.length) * 100) : 0,
      change_requests: changeRequests.length,
      late_change_count: lateChanges.length,
      quick_returns: quickReturns,
      callout_count: callouts.length,
      days_advance_published: Math.round(daysAdvance),
      required_advance_days: requiredAdvanceDays,
      predictability_pay_exposure_count: predictabilityPayExposure,
      instability_score: instabilityScore,
      instability_level: instabilityScore < 15 ? 'stable' : instabilityScore < 35 ? 'moderate' : 'volatile',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;