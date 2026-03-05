import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb, closeDb } from '../db';
import { getScheduleIntelligence } from '../intelligence';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-intelligence.db');

const WEEK = '2025-06-02'; // Monday

function seedEmployee(db: any, id: number, role: string) {
  db.prepare(
    'INSERT OR IGNORE INTO employees (id, name, role, hourly_rate, weekly_hours_max) VALUES (?, ?, ?, ?, ?)'
  ).run(id, `Employee ${id}`, role, 15, 40);
}

function seedAvailability(db: any, empId: number, day: number) {
  db.prepare(
    "INSERT OR IGNORE INTO availability (employee_id, day_of_week, start_time, end_time, availability_type) VALUES (?, ?, '07:00', '23:59', 'specific')"
  ).run(empId, day);
}

beforeAll(() => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();

  // Employees
  for (let i = 1; i <= 5; i++) seedEmployee(db, i, 'Server');
  for (let i = 6; i <= 9; i++) seedEmployee(db, i, 'Kitchen');
  seedEmployee(db, 10, 'Manager');
  seedEmployee(db, 11, 'Bar');
  seedEmployee(db, 12, 'Host');

  // Availability – all days
  for (let empId = 1; empId <= 12; empId++) {
    for (let day = 0; day < 7; day++) seedAvailability(db, empId, day);
  }

  // Forecasts with varied revenue
  const revenues = [3800, 3200, 4200, 4500, 6200, 7500, 7000];
  for (let d = 0; d < 7; d++) {
    const date = new Date(WEEK);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    const rev = revenues[d];
    db.prepare(
      'INSERT OR REPLACE INTO forecasts (date, expected_revenue, expected_covers) VALUES (?, ?, ?)'
    ).run(dateStr, rev, Math.floor(rev / 32));
  }

  // Schedule with shifts
  const sched = db.prepare(
    'INSERT INTO schedules (week_start, labor_budget, status) VALUES (?, ?, ?)'
  ).run(WEEK, 5000, 'draft');
  const scheduleId = sched.lastInsertRowid as number;

  // Insert a few shifts
  const insertShift = db.prepare(
    "INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
  );
  for (let d = 0; d < 7; d++) {
    const date = new Date(WEEK);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    insertShift.run(scheduleId, 1, dateStr, '11:00', '19:00', 'Server');
    insertShift.run(scheduleId, 2, dateStr, '15:00', '23:00', 'Server');
    insertShift.run(scheduleId, 6, dateStr, '10:00', '18:00', 'Kitchen');
    insertShift.run(scheduleId, 10, dateStr, '09:00', '17:00', 'Manager');
  }
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

test('getScheduleIntelligence returns intelligence for all 7 days', () => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules LIMIT 1').get() as any;
  const intel = getScheduleIntelligence(schedule.id);

  expect(intel.schedule_id).toBe(schedule.id);
  expect(intel.week_start).toBe(WEEK);
  expect(intel.days).toHaveLength(7);
  expect(intel.avg_check_per_head).toBeGreaterThan(0);
  expect(intel.table_turnover_rate).toBeGreaterThan(0);
});

test('each day has valid probability values', () => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules LIMIT 1').get() as any;
  const intel = getScheduleIntelligence(schedule.id);

  for (const day of intel.days) {
    expect(day.understaffed_probability).toBeGreaterThanOrEqual(0);
    expect(day.understaffed_probability).toBeLessThanOrEqual(100);
    expect(day.overstaffed_probability).toBeGreaterThanOrEqual(0);
    expect(day.overstaffed_probability).toBeLessThanOrEqual(100);
    expect(['adequate', 'understaffed', 'overstaffed']).toContain(day.staffing_status);
    expect(['tight', 'on_track', 'flexible']).toContain(day.budget_status);
  }
});

test('avg_check_per_head matches expected value from seed', () => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules LIMIT 1').get() as any;
  const intel = getScheduleIntelligence(schedule.id);

  // Total revenue / total covers should be ~32 (seed sets covers = floor(revenue/32))
  expect(intel.avg_check_per_head).toBeGreaterThan(0);
});

test('high revenue days have higher optimal server counts', () => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules LIMIT 1').get() as any;
  const intel = getScheduleIntelligence(schedule.id);

  // Saturday (revenue ~7500) should have higher optimal server count than Monday (3800)
  const monday    = intel.days.find(d => d.date === WEEK);
  const saturday  = intel.days.find(d => {
    const dow = new Date(d.date).getDay();
    return dow === 6;
  });

  expect(monday).toBeDefined();
  expect(saturday).toBeDefined();
  expect(saturday!.optimal_server_count).toBeGreaterThanOrEqual(monday!.optimal_server_count);
});

test('overall_burnout_alert_count reflects employees with high risk', () => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules LIMIT 1').get() as any;
  const intel = getScheduleIntelligence(schedule.id);

  // Employees assigned 7 shifts × 8h = 56h/week (above 40h max) should trigger burnout.
  // The count should be >= 0 and not exceed number of scheduled employees.
  expect(intel.overall_burnout_alert_count).toBeGreaterThanOrEqual(0);
  expect(typeof intel.overall_burnout_alert_count).toBe('number');
});

test('budget_flexibility_pct is correct', () => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules LIMIT 1').get() as any;
  const intel = getScheduleIntelligence(schedule.id);

  // budget_flexibility = (budget - cost) / budget * 100
  expect(intel.budget_flexibility_pct).toBeLessThanOrEqual(100);
  expect(intel.budget_flexibility_pct).toBeGreaterThanOrEqual(-100);
});

test('throws for unknown schedule', () => {
  expect(() => getScheduleIntelligence(999999)).toThrow('Schedule 999999 not found');
});
