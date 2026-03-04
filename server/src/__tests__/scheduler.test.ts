import fs from 'fs';
import { computeWeeklyStaffingNeeds } from '../scheduler';
import { getDb, closeDb } from '../db';
import path from 'path';

process.env.DB_PATH = path.join('/tmp', 'test-scheduler.db');

beforeAll(() => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  // Initialize DB (triggers schema creation)
  getDb();
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

test('computeWeeklyStaffingNeeds returns 7 days', () => {
  const suggestions = computeWeeklyStaffingNeeds('2025-01-06');
  expect(suggestions).toHaveLength(7);
});

test('each suggestion has required fields', () => {
  const suggestions = computeWeeklyStaffingNeeds('2025-01-06');
  for (const day of suggestions) {
    expect(day).toHaveProperty('date');
    expect(day).toHaveProperty('day_of_week');
    expect(day).toHaveProperty('expected_revenue');
    expect(day).toHaveProperty('expected_covers');
    expect(day).toHaveProperty('staffing');
    expect(Array.isArray(day.staffing)).toBe(true);
    expect(day.staffing.length).toBeGreaterThan(0);
  }
});

test('staffing counts increase with higher forecast revenue', () => {
  const db = getDb();
  // Insert a high-revenue forecast for Tuesday 2025-01-07
  db.prepare('INSERT OR REPLACE INTO forecasts (date, expected_revenue, expected_covers) VALUES (?, ?, ?)').run('2025-01-07', 9000, 200);
  // Insert a low-revenue forecast for Wednesday 2025-01-08
  db.prepare('INSERT OR REPLACE INTO forecasts (date, expected_revenue, expected_covers) VALUES (?, ?, ?)').run('2025-01-08', 1000, 20);

  const suggestions = computeWeeklyStaffingNeeds('2025-01-06');
  const highDay = suggestions.find(s => s.date === '2025-01-07');
  const lowDay = suggestions.find(s => s.date === '2025-01-08');

  expect(highDay).toBeDefined();
  expect(lowDay).toBeDefined();

  const highTotal = highDay!.staffing.reduce((sum, s) => sum + s.count, 0);
  const lowTotal = lowDay!.staffing.reduce((sum, s) => sum + s.count, 0);

  expect(highTotal).toBeGreaterThan(lowTotal);
});

test('staffing suggestions include Manager role every day', () => {
  const suggestions = computeWeeklyStaffingNeeds('2025-01-06');
  for (const day of suggestions) {
    const hasManager = day.staffing.some(s => s.role === 'Manager');
    expect(hasManager).toBe(true);
  }
});
