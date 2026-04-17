import { RestaurantSettings } from './types';

// Default restaurant settings (used by the scheduler for labor cost calculations)
const DEFAULT_SETTINGS: RestaurantSettings = {
  seats: 60,
  tables: 15,
  cogs_pct: 30,
  target_labor_pct: 30,
  operating_hours_per_day: 12,
};

/** Returns restaurant settings (hardcoded defaults — no longer persisted to DB). */
export function getRestaurantSettings(): RestaurantSettings {
  return { ...DEFAULT_SETTINGS };
}
