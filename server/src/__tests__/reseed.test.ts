import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-reseed-verify.db');

beforeAll(() => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

test('seedDemoData detects and reseeds a stale database', () => {
  const db = getDb();

  // Simulate an old/stale database: 1 site, 1 employee, forecast with no site_id
  db.prepare("INSERT INTO sites (name, city, state, timezone, site_type) VALUES ('Bella Napoli', 'Chicago', 'IL', 'America/Chicago', 'restaurant')").run();
  db.prepare("INSERT INTO employees (name, role, hourly_rate, weekly_hours_max) VALUES ('Alice', 'Manager', 20, 40)").run();
  db.prepare("INSERT INTO forecasts (date, expected_revenue, expected_covers) VALUES ('2026-01-06', 5000, 100)").run();

  const beforeEmps = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  const beforeForecastsWithSite = (db.prepare('SELECT COUNT(*) as c FROM forecasts WHERE site_id IS NOT NULL').get() as any).c;
  expect(beforeEmps).toBe(1);
  expect(beforeForecastsWithSite).toBe(0);

  // seedDemoData should detect stale data and reseed
  seedDemoData();

  const afterSites = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as any).c;
  const afterEmps = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  const afterForecastsWithSite = (db.prepare('SELECT COUNT(*) as c FROM forecasts WHERE site_id IS NOT NULL').get() as any).c;
  const afterSchedulesWithSite = (db.prepare('SELECT COUNT(*) as c FROM schedules WHERE site_id IS NOT NULL').get() as any).c;

  expect(afterSites).toBeGreaterThanOrEqual(2);
  expect(afterEmps).toBeGreaterThanOrEqual(40);
  expect(afterForecastsWithSite).toBeGreaterThanOrEqual(10);
  expect(afterSchedulesWithSite).toBeGreaterThanOrEqual(2);
});

test('seedDemoData is idempotent when data is already up-to-date', () => {
  const db = getDb();

  const empsBefore = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  expect(empsBefore).toBeGreaterThanOrEqual(40);

  // Calling again should not change anything
  seedDemoData();

  const empsAfter = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  expect(empsAfter).toBe(empsBefore);
});
