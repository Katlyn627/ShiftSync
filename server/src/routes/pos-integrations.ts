import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireManager } from '../middleware/auth';
import { logAudit } from './audit';

const router = Router();

const SUPPORTED_PLATFORMS = ['square', 'toast', 'clover', 'lightspeed', 'revel', 'other'];

// Simulated POS revenue adjustment factor by platform (mirrors typical variance in live vs. seeded data)
const POS_PLATFORM_MULTIPLIERS: Record<string, number> = {
  square:     1.02,
  toast:      0.98,
  clover:     1.01,
  lightspeed: 1.03,
  revel:      0.99,
  other:      1.00,
};

// Baseline daily revenue by day-of-week offset (Mon=0 … Sun=6) — matches seed defaults
// Index 0 = Monday, index 6 = Sunday (not JavaScript's getDay() which is Sun=0)
const BASELINE_REVENUE_BY_OFFSET = [2800, 3200, 3800, 4500, 7200, 8500, 5500];

/**
 * Seasonal / local-event revenue multipliers.
 * These account for predictably high-revenue dates such as Mother's Day,
 * graduation weekends, Memorial Day, Independence Day, and conference periods.
 *
 * Format: each entry defines a date window (MM-DD inclusive) and the revenue
 * lift factor for any day that falls within it.  When multiple windows overlap,
 * the highest multiplier wins (applied once per day, not stacked).
 */
interface SeasonalWindow {
  label: string;
  startMMDD: string;  // inclusive
  endMMDD: string;    // inclusive
  multiplier: number;
}

const SEASONAL_WINDOWS: SeasonalWindow[] = [
  // Mother's Day weekend (second Sunday of May — we cover the whole first two weeks of May)
  { label: "Mother's Day weekend",       startMMDD: '05-06', endMMDD: '05-15', multiplier: 1.45 },
  // Memorial Day weekend
  { label: 'Memorial Day weekend',       startMMDD: '05-23', endMMDD: '05-27', multiplier: 1.35 },
  // Graduation season (late May to mid-June)
  { label: 'Graduation season',          startMMDD: '05-15', endMMDD: '06-15', multiplier: 1.25 },
  // Independence Day (July 4 ± 2 days)
  { label: 'Independence Day',           startMMDD: '07-02', endMMDD: '07-06', multiplier: 1.40 },
  // Labor Day weekend
  { label: 'Labor Day weekend',          startMMDD: '08-30', endMMDD: '09-02', multiplier: 1.30 },
  // Valentine's Day
  { label: "Valentine's Day",            startMMDD: '02-13', endMMDD: '02-15', multiplier: 1.50 },
  // New Year's Eve / Day
  { label: "New Year's Eve",             startMMDD: '12-30', endMMDD: '01-02', multiplier: 1.55 },
  // Christmas / Holiday week
  { label: 'Holiday week',               startMMDD: '12-23', endMMDD: '12-29', multiplier: 1.30 },
  // Thanksgiving week (approximate — Thurs 4th week of Nov)
  { label: 'Thanksgiving week',          startMMDD: '11-21', endMMDD: '11-27', multiplier: 1.35 },
  // Conference season mid-Sept to mid-Oct (common for hotel/downtown venues)
  { label: 'Conference season (fall)',   startMMDD: '09-10', endMMDD: '10-15', multiplier: 1.15 },
  // Spring conference season
  { label: 'Conference season (spring)', startMMDD: '03-01', endMMDD: '04-15', multiplier: 1.10 },
];

/**
 * Returns the seasonal multiplier for a given date (YYYY-MM-DD).
 * If the date falls in multiple windows the highest multiplier wins.
 */
function getSeasonalMultiplier(dateStr: string): number {
  const mmdd = dateStr.slice(5); // "MM-DD"
  let best = 1.0;
  for (const w of SEASONAL_WINDOWS) {
    // Handle windows that wrap around year-end (e.g. 12-30 → 01-02)
    const wraps = w.startMMDD > w.endMMDD;
    const inWindow = wraps
      ? (mmdd >= w.startMMDD || mmdd <= w.endMMDD)
      : (mmdd >= w.startMMDD && mmdd <= w.endMMDD);
    if (inWindow && w.multiplier > best) best = w.multiplier;
  }
  return best;
}

/** Returns YYYY-MM-DD for the Monday of the current week. */
function currentWeekMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  return monday.toISOString().split('T')[0];
}

// List all POS integrations for the current site
router.get('/', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const integrations = siteId
    ? db.prepare('SELECT * FROM pos_integrations WHERE site_id = ? ORDER BY created_at DESC').all(siteId)
    : db.prepare('SELECT * FROM pos_integrations ORDER BY created_at DESC').all();
  res.json(integrations);
});

// Add a new POS integration
router.post('/', requireManager, (req: Request, res: Response) => {
  const { platform_name, display_name, api_key } = req.body;
  if (!platform_name || !SUPPORTED_PLATFORMS.includes(platform_name)) {
    return res.status(400).json({ error: `platform_name must be one of: ${SUPPORTED_PLATFORMS.join(', ')}` });
  }
  const db = getDb();
  const siteId = req.user?.siteId ?? null;

  // Mask the API key for storage — only expose first 4 and last 4 characters
  const key = (api_key ?? '').toString();
  const api_key_masked = key.length > 8
    ? `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`
    : key.length > 0 ? '****' : '';

  const result = db.prepare(
    'INSERT INTO pos_integrations (site_id, platform_name, display_name, api_key_masked, status) VALUES (?, ?, ?, ?, ?)'
  ).run(siteId, platform_name, display_name || platform_name, api_key_masked, 'connected');

  logAudit({
    action: 'pos_integration_added',
    entity_type: 'pos_integration',
    entity_id: result.lastInsertRowid as number,
    user_id: req.user?.userId,
    details: { platform_name, site_id: siteId },
  });

  const integration = db.prepare('SELECT * FROM pos_integrations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(integration);
});

// Delete a POS integration
router.delete('/:id', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const integration = db.prepare('SELECT * FROM pos_integrations WHERE id = ?').get(req.params.id) as any;
  if (!integration) return res.status(404).json({ error: 'Integration not found' });
  db.prepare('DELETE FROM pos_integrations WHERE id = ?').run(req.params.id);

  logAudit({
    action: 'pos_integration_removed',
    entity_type: 'pos_integration',
    entity_id: parseInt(req.params.id, 10),
    user_id: req.user?.userId,
    details: { platform_name: integration.platform_name },
  });

  res.json({ success: true });
});

/**
 * Simulate a POS data sync:
 * - Pulls the seeded forecast data as a baseline
 * - Applies a platform-specific multiplier + small random variation (±3%) to simulate live POS data
 * - Upserts forecast rows for the current week and the next week
 * This keeps the schedule generation algorithm driven by realistic, up-to-date revenue figures.
 */
router.post('/:id/sync', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const integration = db.prepare('SELECT * FROM pos_integrations WHERE id = ?').get(req.params.id) as any;
  if (!integration) return res.status(404).json({ error: 'Integration not found' });

  const siteId: number | null = integration.site_id;
  const platformMultiplier = POS_PLATFORM_MULTIPLIERS[integration.platform_name] ?? 1.0;

  // Determine the Monday of the current week
  const thisMondayStr = currentWeekMonday();
  const thisMonday = new Date(thisMondayStr);

  const upsertForecast = db.prepare(
    'INSERT OR REPLACE INTO forecasts (date, site_id, expected_revenue, expected_covers) VALUES (?, ?, ?, ?)'
  );

  let totalRevenueSynced = 0;
  let totalCoversSynced = 0;
  const syncedDates: string[] = [];

  // Sync 2 weeks: current + next
  for (let week = 0; week < 2; week++) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(thisMonday);
      date.setDate(thisMonday.getDate() + week * 7 + dayOffset);
      const dateStr = date.toISOString().split('T')[0];

      // Use existing seeded forecast as base, or fall back to hardcoded baseline
      const existing = siteId
        ? (db.prepare('SELECT * FROM forecasts WHERE date = ? AND site_id = ?').get(dateStr, siteId) as any)
        : (db.prepare('SELECT * FROM forecasts WHERE date = ? AND site_id IS NULL').get(dateStr) as any);

      const baseRevenue = existing?.expected_revenue ?? BASELINE_REVENUE_BY_OFFSET[dayOffset];

      // Apply platform multiplier + ±3% random variation + seasonal/event lift
      const variation = 0.97 + Math.random() * 0.06;
      const seasonalMultiplier = getSeasonalMultiplier(dateStr);
      const posRevenue = Math.round(baseRevenue * platformMultiplier * variation * seasonalMultiplier);
      const avgCheck = 40;
      const posCovers = Math.floor(posRevenue / avgCheck);

      upsertForecast.run(dateStr, siteId, posRevenue, posCovers);
      totalRevenueSynced += posRevenue;
      totalCoversSynced += posCovers;
      syncedDates.push(dateStr);
    }
  }

  // Record sync metadata on the integration row — store the per-week average revenue
  // (total covers 2 weeks so divide by 2 to get a representative weekly figure)
  db.prepare(
    "UPDATE pos_integrations SET last_synced_at = datetime('now'), last_sync_status = ?, last_sync_revenue = ?, last_sync_covers = ? WHERE id = ?"
  ).run('success', Math.round(totalRevenueSynced / 2), Math.round(totalCoversSynced / 2), req.params.id);

  logAudit({
    action: 'pos_sync_completed',
    entity_type: 'pos_integration',
    entity_id: parseInt(req.params.id, 10),
    user_id: req.user?.userId,
    details: {
      platform_name: integration.platform_name,
      dates_synced: syncedDates.length,
      total_revenue: totalRevenueSynced,
    },
  });

  const updated = db.prepare('SELECT * FROM pos_integrations WHERE id = ?').get(req.params.id);

  // Summarise any seasonal events that affected the synced dates
  const activeEvents = [...new Set(
    syncedDates.flatMap(d => SEASONAL_WINDOWS
      .filter(w => {
        const mmdd = d.slice(5);
        const wraps = w.startMMDD > w.endMMDD;
        return wraps
          ? (mmdd >= w.startMMDD || mmdd <= w.endMMDD)
          : (mmdd >= w.startMMDD && mmdd <= w.endMMDD);
      })
      .map(w => w.label)
    )
  )];

  res.json({
    integration: updated,
    synced_dates: syncedDates.length,
    total_revenue_synced: Math.round(totalRevenueSynced),
    total_covers_synced: totalCoversSynced,
    seasonal_events_applied: activeEvents,
  });
});

export default router;
