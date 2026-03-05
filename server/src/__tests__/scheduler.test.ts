import fs from 'fs';
import os from 'os';
import { computeWeeklyStaffingNeeds, generateSchedule } from '../scheduler';
import { getScheduleCoverageReport } from '../coverage';
import { getDb, closeDb } from '../db';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-scheduler.db');

beforeAll(() => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  // Initialize DB (triggers schema creation)
  getDb();
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

// ── Helpers ────────────────────────────────────────────────────────────────

function seedEmployee(db: ReturnType<typeof getDb>, id: number, role: string, hourlyRate = 15, weeklyMax = 40) {
  db.prepare(`
    INSERT OR REPLACE INTO employees (id, name, role, hourly_rate, weekly_hours_max)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, `Employee ${id}`, role, hourlyRate, weeklyMax);
}

function seedAvailability(db: ReturnType<typeof getDb>, employeeId: number, dayOfWeek: number) {
  db.prepare(`
    INSERT OR REPLACE INTO availability (employee_id, day_of_week, start_time, end_time)
    VALUES (?, ?, '08:00', '23:59')
  `).run(employeeId, dayOfWeek);
}

// ── Original tests ─────────────────────────────────────────────────────────

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

// ── Enhanced algorithm tests ───────────────────────────────────────────────

describe('generateSchedule - enhanced algorithm', () => {
  const WEEK = '2025-03-03'; // A Monday

  beforeEach(() => {
    const db = getDb();
    // Clean up previous test data
    db.prepare('DELETE FROM shifts WHERE schedule_id IN (SELECT id FROM schedules WHERE week_start = ?)').run(WEEK);
    db.prepare('DELETE FROM standby_assignments WHERE schedule_id IN (SELECT id FROM schedules WHERE week_start = ?)').run(WEEK);
    db.prepare('DELETE FROM schedules WHERE week_start = ?').run(WEEK);
  });

  test('generateSchedule creates a schedule record', () => {
    const db = getDb();
    // Seed minimal employees and availability
    seedEmployee(db, 100, 'Manager');
    for (let day = 0; day < 7; day++) seedAvailability(db, 100, day);

    const scheduleId = generateSchedule({ weekStart: WEEK, laborBudget: 10000 });
    expect(scheduleId).toBeGreaterThan(0);

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
    expect(schedule).toBeTruthy();
    expect(schedule.week_start).toBe(WEEK);
  });

  test('standby assignments are created for high-revenue days', () => {
    const db = getDb();
    // Insert a very high revenue forecast
    db.prepare('INSERT OR REPLACE INTO forecasts (date, expected_revenue, expected_covers) VALUES (?, ?, ?)')
      .run('2025-03-03', 8000, 200);

    // Seed employees: enough to fill regular shifts + have leftover for standbys
    seedEmployee(db, 200, 'Server', 15, 40);
    seedEmployee(db, 201, 'Server', 15, 40);
    seedEmployee(db, 202, 'Server', 15, 40);
    seedEmployee(db, 203, 'Kitchen', 15, 40);
    seedEmployee(db, 204, 'Kitchen', 15, 40);
    seedEmployee(db, 205, 'Bar', 15, 40);
    seedEmployee(db, 206, 'Host', 15, 40);
    seedEmployee(db, 207, 'Manager', 20, 40);
    seedEmployee(db, 208, 'Server', 15, 40); // extra for standby
    seedEmployee(db, 209, 'Kitchen', 15, 40); // extra for standby

    const empIds = [200, 201, 202, 203, 204, 205, 206, 207, 208, 209];
    for (const id of empIds) {
      for (let day = 0; day < 7; day++) seedAvailability(db, id, day);
    }

    const scheduleId = generateSchedule({ weekStart: WEEK, laborBudget: 20000 });

    const standbys = db.prepare(
      "SELECT * FROM standby_assignments WHERE schedule_id = ? AND date = '2025-03-03'"
    ).all(scheduleId) as any[];

    // Should have standbys for a high-revenue day
    expect(standbys.length).toBeGreaterThan(0);
  });

  test('coverage report has correct structure', () => {
    const db = getDb();
    seedEmployee(db, 300, 'Manager', 20, 40);
    for (let day = 0; day < 7; day++) seedAvailability(db, 300, day);

    const scheduleId = generateSchedule({ weekStart: WEEK, laborBudget: 10000 });
    const report = getScheduleCoverageReport(scheduleId);

    expect(report.schedule_id).toBe(scheduleId);
    expect(report.week_start).toBe(WEEK);
    expect(report.days).toHaveLength(7);
    expect(report).toHaveProperty('total_standby_count');
    expect(report).toHaveProperty('days_at_risk');

    for (const day of report.days) {
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('expected_revenue');
      expect(day).toHaveProperty('scheduled_count');
      expect(day).toHaveProperty('standby_count');
      expect(day).toHaveProperty('standbys');
      expect(day).toHaveProperty('coverage_status');
      expect(['good', 'at_risk', 'critical']).toContain(day.coverage_status);
    }
  });

  test('employees do not exceed 6 consecutive working days', () => {
    const db = getDb();

    // Seed a single Server available every day - they should not be scheduled 7 days straight
    seedEmployee(db, 400, 'Server', 15, 40);
    for (let day = 0; day < 7; day++) seedAvailability(db, 400, day);

    // Also seed another Server so we're not dependent on just one
    seedEmployee(db, 401, 'Server', 15, 40);
    for (let day = 0; day < 7; day++) seedAvailability(db, 401, day);

    // Low revenue so fewer shifts are needed per day
    for (let i = 0; i < 7; i++) {
      const d = new Date(WEEK);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      db.prepare('INSERT OR REPLACE INTO forecasts (date, expected_revenue, expected_covers) VALUES (?, ?, ?)')
        .run(dateStr, 1500, 30);
    }

    const scheduleId = generateSchedule({ weekStart: WEEK, laborBudget: 10000 });

    // Check emp 400's shifts
    const shifts = db.prepare(
      'SELECT DISTINCT date FROM shifts WHERE schedule_id = ? AND employee_id = ? ORDER BY date'
    ).all(scheduleId, 400) as Array<{ date: string }>;

    // Count max consecutive days
    let maxConsec = 0;
    let consec = 1;
    for (let i = 1; i < shifts.length; i++) {
      const prev = new Date(shifts[i - 1].date);
      const curr = new Date(shifts[i].date);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        consec++;
        maxConsec = Math.max(maxConsec, consec);
      } else {
        consec = 1;
      }
    }
    if (shifts.length > 0) maxConsec = Math.max(maxConsec, 1);

    expect(maxConsec).toBeLessThanOrEqual(6);
  });

  test('burnout-adjusted max hours limits scheduling for high-burnout employees', () => {
    const db = getDb();

    // Seed a previous schedule with a high burnout-risk employee
    const prevScheduleRes = db.prepare(
      "INSERT INTO schedules (week_start, labor_budget, status) VALUES ('2025-02-24', 10000, 'published')"
    ).run();
    const prevScheduleId = prevScheduleRes.lastInsertRowid as number;

    // Seed employee 500 as Server with low max hours to make burnout easier to trigger
    seedEmployee(db, 500, 'Server', 15, 32);
    for (let day = 0; day < 7; day++) seedAvailability(db, 500, day);

    // Create a bunch of shifts in the prev week to push this employee to high burnout
    // 6 days × 8h = 48h (over their 32h max) → triggers overtime burnout factor
    for (let i = 0; i < 6; i++) {
      const d = new Date('2025-02-24');
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      db.prepare(
        "INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, '09:00', '17:00', 'Server', 'scheduled')"
      ).run(prevScheduleId, 500, dateStr);
    }

    // Now generate the current week's schedule with a generous budget
    const scheduleId = generateSchedule({ weekStart: WEEK, laborBudget: 20000 });

    // Employee 500's effective max should be reduced
    // High burnout (score >= 70) → cap at floor(weeklyMax * 0.85) hours
    const WEEKLY_MAX = 32;
    const HIGH_BURNOUT_HOURS_FACTOR = 0.85; // mirrors BURNOUT_HIGH_HOURS_FACTOR in scheduler.ts
    const expectedCap = Math.floor(WEEKLY_MAX * HIGH_BURNOUT_HOURS_FACTOR);

    const shifts = db.prepare(
      'SELECT start_time, end_time FROM shifts WHERE schedule_id = ? AND employee_id = ?'
    ).all(scheduleId, 500) as Array<{ start_time: string; end_time: string }>;

    const totalHours = shifts.reduce((sum, s) => {
      const start = s.start_time.split(':').map(Number);
      const end = s.end_time.split(':').map(Number);
      const startMins = start[0] * 60 + start[1];
      let endMins = end[0] * 60 + end[1];
      if (endMins < startMins) endMins += 24 * 60;
      return sum + (endMins - startMins) / 60;
    }, 0);

    // Employee 500 should be capped at the burnout-adjusted limit
    expect(totalHours).toBeLessThanOrEqual(expectedCap + 0.1);
  });
});
