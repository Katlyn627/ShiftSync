import fs from 'fs';
import os from 'os';
import { getLaborCostSummary } from '../laborCost';
import { getDb, closeDb } from '../db';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-labor.db');

beforeAll(() => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  db.prepare('INSERT INTO employees (id, name, role, hourly_rate, weekly_hours_max) VALUES (1, ?, ?, ?, ?)').run('Alice', 'Server', 20, 40);
  db.prepare('INSERT INTO schedules (id, week_start, labor_budget, status) VALUES (1, ?, 5000, ?)').run('2025-01-06', 'draft');
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (1,1,?,?,?,?)').run('2025-01-06', '09:00', '17:00', 'Server');
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

test('calculates projected cost correctly', () => {
  const summary = getLaborCostSummary(1);
  // 8 hours * $20/hr = $160
  expect(summary.projected_cost).toBe(160);
  expect(summary.labor_budget).toBe(5000);
  expect(summary.variance).toBe(160 - 5000);
});

test('by_day breakdown is correct', () => {
  const summary = getLaborCostSummary(1);
  expect(summary.by_day).toHaveLength(1);
  expect(summary.by_day[0].date).toBe('2025-01-06');
  expect(summary.by_day[0].cost).toBe(160);
});

test('throws for nonexistent schedule', () => {
  expect(() => getLaborCostSummary(999)).toThrow();
});