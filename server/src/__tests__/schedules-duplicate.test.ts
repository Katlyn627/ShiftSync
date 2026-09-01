import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import schedulesRouter from '../routes/schedules';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-schedules-duplicate.db');

let app: express.Express;
let managerToken: string;
let employeeToken: string;
let sourceScheduleId: number;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/schedules', schedulesRouter);

  const managerLogin = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'password123' });
  managerToken = managerLogin.body.token;

  const employeeLogin = await request(app).post('/api/auth/login').send({ username: 'bob', password: 'password123' });
  employeeToken = employeeLogin.body.token;

  const sched = db.prepare(`
    SELECT s.id FROM schedules s
    JOIN employees e ON s.site_id = e.site_id
    JOIN users u ON u.employee_id = e.id
    WHERE u.username = 'alice'
    ORDER BY s.id LIMIT 1
  `).get() as { id: number };
  sourceScheduleId = sched.id;
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('POST /api/schedules/:id/duplicate', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post(`/api/schedules/${sourceScheduleId}/duplicate`)
      .send({ target_week_start: '2026-09-07' });
    expect(res.status).toBe(401);
  });

  test('rejects employee requests with 403', async () => {
    const res = await request(app)
      .post(`/api/schedules/${sourceScheduleId}/duplicate`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ target_week_start: '2026-09-07' });
    expect(res.status).toBe(403);
  });

  test('rejects missing or invalid target_week_start with 400', async () => {
    const missing = await request(app)
      .post(`/api/schedules/${sourceScheduleId}/duplicate`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(missing.status).toBe(400);

    const invalid = await request(app)
      .post(`/api/schedules/${sourceScheduleId}/duplicate`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ target_week_start: 'not-a-date' });
    expect(invalid.status).toBe(400);
  });

  test('successfully duplicates schedule and shifts with correct day offset', async () => {
    const db = getDb();
    const sourceSchedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(sourceScheduleId) as any;
    const sourceShifts = db.prepare('SELECT * FROM shifts WHERE schedule_id = ?').all(sourceScheduleId) as any[];
    expect(sourceShifts.length).toBeGreaterThan(0);

    const targetWeekStart = '2026-10-05';
    const res = await request(app)
      .post(`/api/schedules/${sourceScheduleId}/duplicate`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ target_week_start: targetWeekStart });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.week_start).toBe(targetWeekStart);
    expect(res.body.status).toBe('draft');

    const newScheduleId = res.body.id;
    const newShifts = db.prepare('SELECT * FROM shifts WHERE schedule_id = ?').all(newScheduleId) as any[];
    expect(newShifts.length).toBe(sourceShifts.length);

    // Verify day offsets: source Monday shift moves to target Monday, etc.
    const sourceFirstShift = sourceShifts[0];
    const sourceDate = new Date(`${sourceSchedule.week_start}T12:00:00Z`);
    const shiftDate = new Date(`${sourceFirstShift.date}T12:00:00Z`);
    const dayOfWeekOffset = Math.round((shiftDate.getTime() - sourceDate.getTime()) / (24 * 60 * 60 * 1000));

    const expectedNewDate = new Date(`${targetWeekStart}T12:00:00Z`);
    expectedNewDate.setUTCDate(expectedNewDate.getUTCDate() + dayOfWeekOffset);
    const expectedIso = expectedNewDate.toISOString().slice(0, 10);

    const matchingNewShift = newShifts.find((s) => s.employee_id === sourceFirstShift.employee_id && s.start_time === sourceFirstShift.start_time);
    expect(matchingNewShift).toBeDefined();
    expect(matchingNewShift.date).toBe(expectedIso);
  });

  test('returns 404 for nonexistent source schedule', async () => {
    const res = await request(app)
      .post('/api/schedules/999999/duplicate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ target_week_start: '2026-09-07' });
    expect(res.status).toBe(404);
  });
});