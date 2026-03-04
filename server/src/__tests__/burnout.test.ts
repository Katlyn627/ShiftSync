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

test('detects late-night shifts and provides rest day recommendations', () => {
  const db = getDb();
  // Insert employee 2 and a schedule 2
  db.prepare('INSERT INTO employees (id, name, role, hourly_rate, weekly_hours_max) VALUES (2, ?, ?, ?, ?)').run('Night Owl', 'Bar', 18, 40);
  db.prepare('INSERT INTO schedules (id, week_start, labor_budget, status) VALUES (2, ?, 5000, ?)').run('2025-01-13', 'draft');
  // Insert 4 late-night shifts (ending at 00:00 = overnight)
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (2,2,?,?,?,?)').run('2025-01-13', '16:00', '00:00', 'Bar');
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (2,2,?,?,?,?)').run('2025-01-14', '16:00', '00:00', 'Bar');
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (2,2,?,?,?,?)').run('2025-01-15', '16:00', '00:00', 'Bar');
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (2,2,?,?,?,?)').run('2025-01-16', '16:00', '00:00', 'Bar');

  const risks = calculateBurnoutRisks(2);
  const empRisk = risks.find(r => r.employee_id === 2);
  expect(empRisk).toBeDefined();
  expect(empRisk!.late_night_shifts).toBeGreaterThanOrEqual(4);
  expect(empRisk!.factors.some(f => f.includes('late-night'))).toBe(true);
});

test('rest_days_recommended is 0 for low risk employees', () => {
  const db = getDb();
  db.prepare('INSERT INTO employees (id, name, role, hourly_rate, weekly_hours_max) VALUES (3, ?, ?, ?, ?)').run('Light Worker', 'Host', 15, 40);
  db.prepare('INSERT INTO schedules (id, week_start, labor_budget, status) VALUES (3, ?, 5000, ?)').run('2025-01-20', 'draft');
  // Insert a single short shift — low risk
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (3,3,?,?,?,?)').run('2025-01-20', '09:00', '13:00', 'Host');

  const risks = calculateBurnoutRisks(3);
  const empRisk = risks.find(r => r.employee_id === 3);
  expect(empRisk).toBeDefined();
  expect(empRisk!.risk_level).toBe('low');
  expect(empRisk!.rest_days_recommended).toBe(0);
});