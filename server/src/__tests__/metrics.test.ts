import fs from 'fs';
import os from 'os';
import path from 'path';
import { getProfitabilityMetrics, getRestaurantSettings, saveRestaurantSettings } from '../metrics';
import { getDb, closeDb } from '../db';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-metrics.db');

beforeAll(() => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();

  db.prepare('INSERT INTO employees (id, name, role, hourly_rate, weekly_hours_max) VALUES (1, ?, ?, ?, ?)').run('Alice', 'Server', 20, 40);
  db.prepare('INSERT INTO employees (id, name, role, hourly_rate, weekly_hours_max) VALUES (2, ?, ?, ?, ?)').run('Bob', 'Kitchen', 18, 40);
  db.prepare('INSERT INTO schedules (id, week_start, labor_budget, status) VALUES (1, ?, 5000, ?)').run('2025-01-06', 'draft');

  // Add forecasts for the week
  for (let i = 0; i < 7; i++) {
    const d = new Date('2025-01-06');
    d.setDate(d.getDate() + i);
    const date = d.toISOString().split('T')[0];
    db.prepare('INSERT OR REPLACE INTO forecasts (date, expected_revenue, expected_covers) VALUES (?, ?, ?)').run(date, 4000, 80);
  }

  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (1,1,?,?,?,?)').run('2025-01-06', '11:00', '19:00', 'Server');
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (1,2,?,?,?,?)').run('2025-01-07', '10:00', '18:00', 'Kitchen');
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

test('getRestaurantSettings returns defaults when no row exists', () => {
  const settings = getRestaurantSettings();
  expect(settings.seats).toBe(60);
  expect(settings.tables).toBe(15);
  expect(settings.cogs_pct).toBe(30);
  expect(settings.target_labor_pct).toBe(30);
  expect(settings.operating_hours_per_day).toBe(12);
});

test('saveRestaurantSettings persists and returns merged settings', () => {
  const saved = saveRestaurantSettings({ seats: 80, tables: 20 });
  expect(saved.seats).toBe(80);
  expect(saved.tables).toBe(20);
  expect(saved.cogs_pct).toBe(30); // default preserved

  // Re-fetch to confirm persistence
  const fetched = getRestaurantSettings();
  expect(fetched.seats).toBe(80);
  expect(fetched.tables).toBe(20);
});

test('getProfitabilityMetrics returns correct structure', () => {
  const metrics = getProfitabilityMetrics(1);
  expect(metrics.schedule_id).toBe(1);
  expect(metrics.week_start).toBe('2025-01-06');
  expect(typeof metrics.prime_cost_pct).toBe('number');
  expect(typeof metrics.labor_cost_pct).toBe('number');
  expect(typeof metrics.revpash).toBe('number');
  expect(typeof metrics.table_turnover_rate).toBe('number');
  expect(typeof metrics.avg_check_per_head).toBe('number');
  expect(Array.isArray(metrics.sales_by_daypart)).toBe(true);
  expect(metrics.sales_by_daypart.length).toBe(4);
});

test('prime_cost_pct is non-negative and reasonable', () => {
  const metrics = getProfitabilityMetrics(1);
  expect(metrics.prime_cost_pct).toBeGreaterThanOrEqual(0);
  expect(metrics.prime_cost_pct).toBeLessThan(200);
});

test('avg_check_per_head equals revenue / covers', () => {
  const metrics = getProfitabilityMetrics(1);
  // 7 days × 4000 revenue / 7 days × 80 covers = 4000/80 = 50
  expect(metrics.avg_check_per_head).toBeCloseTo(50, 1);
});

test('prime_cost_status is good when prime cost < 60%', () => {
  const metrics = getProfitabilityMetrics(1);
  if (metrics.prime_cost_pct < 60) {
    expect(metrics.prime_cost_status).toBe('good');
  } else if (metrics.prime_cost_pct <= 65) {
    expect(metrics.prime_cost_status).toBe('warning');
  } else {
    expect(metrics.prime_cost_status).toBe('over');
  }
});

test('sales_by_daypart covers all required dayparts', () => {
  const metrics = getProfitabilityMetrics(1);
  const dayparts = metrics.sales_by_daypart.map(d => d.daypart);
  expect(dayparts).toContain('Breakfast');
  expect(dayparts).toContain('Lunch');
  expect(dayparts).toContain('Dinner');
  expect(dayparts).toContain('Late Night');
});

test('sales_by_daypart revenue values sum to total expected revenue', () => {
  const metrics = getProfitabilityMetrics(1);
  const totalRevenue = metrics.sales_by_daypart.reduce((sum, dp) => sum + dp.revenue, 0);
  expect(totalRevenue).toBeCloseTo(metrics.total_expected_revenue, 1);
});

test('sales_by_daypart each item has a non-negative revenue', () => {
  const metrics = getProfitabilityMetrics(1);
  for (const dp of metrics.sales_by_daypart) {
    expect(dp.revenue).toBeGreaterThanOrEqual(0);
  }
});

test('total_labor_cost matches shifts data', () => {
  const metrics = getProfitabilityMetrics(1);
  // Alice: 8h × $20 = $160, Bob: 8h × $18 = $144. Total = $304
  expect(metrics.total_labor_cost).toBeCloseTo(304, 1);
});

test('throws for nonexistent schedule', () => {
  expect(() => getProfitabilityMetrics(9999)).toThrow();
});
