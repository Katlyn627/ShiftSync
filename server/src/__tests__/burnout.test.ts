import { calculateBurnoutRisks } from '../burnout';
import { getDb, closeDb } from '../db';
import path from 'path';

process.env.DB_PATH = path.join('/tmp', 'test-burnout.db');

beforeAll(() => {
  const fs = require('fs');
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  // Insert test employee
  db.prepare('INSERT INTO employees (id, name, role, hourly_rate, weekly_hours_max) VALUES (1, ?, ?, ?, ?)').run('Test Worker', 'Server', 15, 40);
  // Insert a schedule
  db.prepare('INSERT INTO schedules (id, week_start, labor_budget, status) VALUES (1, ?, 5000, ?)').run('2025-01-06', 'draft');
});

afterAll(() => {
  closeDb();
  const fs = require('fs');
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

test('returns empty array when no shifts exist', () => {
  const risks = calculateBurnoutRisks(1);
  expect(Array.isArray(risks)).toBe(true);
});

test('detects doubles', () => {
  const db = getDb();
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (1,1,?,?,?,?)').run('2025-01-06', '09:00', '13:00', 'Server');
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (1,1,?,?,?,?)').run('2025-01-06', '15:00', '21:00', 'Server');
  
  const risks = calculateBurnoutRisks(1);
  const empRisk = risks.find(r => r.employee_id === 1);
  expect(empRisk).toBeDefined();
  expect(empRisk!.doubles).toBeGreaterThan(0);
  expect(empRisk!.factors.some(f => f.includes('double'))).toBe(true);
});

test('risk levels are valid', () => {
  const risks = calculateBurnoutRisks(1);
  for (const r of risks) {
    expect(['low', 'medium', 'high']).toContain(r.risk_level);
    expect(r.risk_score).toBeGreaterThanOrEqual(0);
    expect(r.risk_score).toBeLessThanOrEqual(100);
  }
});
