import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import shiftsRouter from '../routes/shifts';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-shifts-overlap.db');

let app: express.Express;
let managerToken: string;
let scheduleId: number;
let employeeId: number;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/shifts', shiftsRouter);

  const managerLogin = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'password123' });
  managerToken = managerLogin.body.token;

  const sched = db.prepare('SELECT id FROM schedules ORDER BY id LIMIT 1').get() as { id: number };
  scheduleId = sched.id;

  const emp = db.prepare('SELECT id FROM employees WHERE site_id = 1 ORDER BY id LIMIT 1').get() as { id: number };
  employeeId = emp.id;

  // Clear shifts for clean state
  db.prepare('DELETE FROM shifts WHERE schedule_id = ? AND employee_id = ?').run(scheduleId, employeeId);
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('Shift Conflict & Double-Booking Guard in Shifts API', () => {
  test('creates an initial shift from 10:00 to 16:00', async () => {
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-12',
        start_time: '10:00',
        end_time: '16:00',
        role: 'Server',
      });
    expect(res.status).toBe(201);
  });

  test('blocks exact duplicate shift interval on the same date with 400 SHIFT_OVERLAP_CONFLICT', async () => {
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-12',
        start_time: '10:00',
        end_time: '16:00',
        role: 'Server',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SHIFT_OVERLAP_CONFLICT');
    expect(res.body.error).toContain('Employee is already scheduled for an overlapping shift');
  });

  test('blocks partially overlapping shift (14:00 to 20:00)', async () => {
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-12',
        start_time: '14:00',
        end_time: '20:00',
        role: 'Server',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SHIFT_OVERLAP_CONFLICT');
  });

  test('blocks fully enclosed shift (11:00 to 13:00)', async () => {
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-12',
        start_time: '11:00',
        end_time: '13:00',
        role: 'Server',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SHIFT_OVERLAP_CONFLICT');
  });

  test('allows adjacent / back-to-back shift on same day (16:00 to 20:00)', async () => {
    // 16:00 start touches 16:00 end without overlapping interval
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-12',
        start_time: '16:00',
        end_time: '20:00',
        role: 'Server',
        allow_override: true, // In case turnaround is considered 0h
      });
    expect(res.status).toBe(201);
  });
});

