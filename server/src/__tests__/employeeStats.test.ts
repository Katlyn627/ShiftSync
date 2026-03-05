import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import employeesRouter from '../routes/employees';
import authRouter from '../routes/auth';
import express from 'express';
import request from 'supertest';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-employee-stats.db');

let app: express.Express;
let managerToken: string;
let employeeToken: string;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/employees', employeesRouter);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: 'password123' });
  managerToken = loginRes.body.token;

  const empLoginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'bob', password: 'password123' });
  employeeToken = empLoginRes.body.token;
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('GET /api/employees/:id/stats', () => {
  test('returns 400 when schedule_id is missing', async () => {
    const db = getDb();
    const employee = db.prepare('SELECT id FROM employees LIMIT 1').get() as any;
    const res = await request(app)
      .get(`/api/employees/${employee.id}/stats`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('returns 404 for a nonexistent employee', async () => {
    const db = getDb();
    const schedule = db.prepare('SELECT id FROM schedules LIMIT 1').get() as any;
    const res = await request(app)
      .get(`/api/employees/99999/stats?schedule_id=${schedule?.id ?? 1}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(404);
  });

  test('returns stats for a valid employee and schedule', async () => {
    const db = getDb();
    const employee = db.prepare('SELECT id FROM employees LIMIT 1').get() as any;
    const schedule = db.prepare('SELECT id FROM schedules LIMIT 1').get() as any;

    if (!schedule) return; // no schedules seeded, skip

    const res = await request(app)
      .get(`/api/employees/${employee.id}/stats?schedule_id=${schedule.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee_id).toBe(employee.id);
    expect(res.body.schedule_id).toBe(schedule.id);
    expect(typeof res.body.shifts_count).toBe('number');
    expect(typeof res.body.total_hours).toBe('number');
    expect(typeof res.body.labor_cost).toBe('number');
    expect(typeof res.body.overtime_hours).toBe('number');
    expect(typeof res.body.avg_hours_per_shift).toBe('number');
    expect(res.body.overtime_hours).toBeGreaterThanOrEqual(0);
  });

  test('stats are correct for a manually created shift', async () => {
    const db = getDb();
    // Insert a known employee, schedule, and shift for deterministic test
    db.prepare('INSERT INTO employees (id, name, role, hourly_rate, weekly_hours_max) VALUES (500, ?, ?, ?, ?)')
      .run('Test Worker', 'Server', 25, 40);
    db.prepare('INSERT INTO schedules (id, week_start, labor_budget, status) VALUES (500, ?, 5000, ?)')
      .run('2026-03-09', 'draft');
    db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (500, 500, ?, ?, ?, ?)')
      .run('2026-03-09', '09:00', '17:00', 'Server'); // 8 hours

    const res = await request(app)
      .get('/api/employees/500/stats?schedule_id=500')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shifts_count).toBe(1);
    expect(res.body.total_hours).toBeCloseTo(8);
    expect(res.body.labor_cost).toBeCloseTo(200); // 8h * $25/hr
    expect(res.body.overtime_hours).toBe(0);
    expect(res.body.avg_hours_per_shift).toBeCloseTo(8);
  });

  test('requires authentication', async () => {
    const db = getDb();
    const employee = db.prepare('SELECT id FROM employees LIMIT 1').get() as any;
    const res = await request(app)
      .get(`/api/employees/${employee.id}/stats?schedule_id=1`);
    expect(res.status).toBe(401);
  });

  test('is accessible by non-manager employees', async () => {
    const db = getDb();
    const employee = db.prepare('SELECT id FROM employees LIMIT 1').get() as any;
    const schedule = db.prepare('SELECT id FROM schedules LIMIT 1').get() as any;
    if (!schedule) return;
    const res = await request(app)
      .get(`/api/employees/${employee.id}/stats?schedule_id=${schedule.id}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
  });
});
