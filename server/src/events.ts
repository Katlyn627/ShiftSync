/**
 * Shared seasonal / holiday event windows used by both the POS sync and
 * the schedule generate-preview endpoint.
 *
 * Each window defines a date range (MM-DD, inclusive) and:
 *  - a revenue lift multiplier for POS forecast simulation
 *  - a human-readable label surfaced in the UI as an event badge
 *
 * When a date falls in multiple windows the highest multiplier wins
 * (applied once per day, not stacked).  All event labels for the date
 * are returned by getEventsForDate().
 */

export interface SeasonalWindow {
  label: string;
  startMMDD: string; // inclusive
  endMMDD: string;   // inclusive
  multiplier: number;
}

export const SEASONAL_WINDOWS: SeasonalWindow[] = [
  // Mother's Day weekend (second Sunday of May — cover first two weeks of May)
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
export function getSeasonalMultiplier(dateStr: string): number {
  const mmdd = dateStr.slice(5); // "MM-DD"
  let best = 1.0;
  for (const w of SEASONAL_WINDOWS) {
    const wraps = w.startMMDD > w.endMMDD;
    const inWindow = wraps
      ? (mmdd >= w.startMMDD || mmdd <= w.endMMDD)
      : (mmdd >= w.startMMDD && mmdd <= w.endMMDD);
    if (inWindow && w.multiplier > best) best = w.multiplier;
  }
  return best;
}

/**
 * Returns an array of all event / holiday labels that apply to the given date
 * (YYYY-MM-DD). Returns an empty array when no events apply.
 */
export function getEventsForDate(dateStr: string): string[] {
  const mmdd = dateStr.slice(5); // "MM-DD"
  const labels: string[] = [];
  for (const w of SEASONAL_WINDOWS) {
    const wraps = w.startMMDD > w.endMMDD;
    const inWindow = wraps
      ? (mmdd >= w.startMMDD || mmdd <= w.endMMDD)
      : (mmdd >= w.startMMDD && mmdd <= w.endMMDD);
    if (inWindow) labels.push(w.label);
  }
  return labels;
}
