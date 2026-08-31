import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import shiftsRouter from '../routes/shifts';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-shifts-rest-window.db');

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

  // Clear existing shifts for this employee in this schedule to test precisely
  db.prepare('DELETE FROM shifts WHERE schedule_id = ? AND employee_id = ?').run(scheduleId, employeeId);
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('Rest Window & Clopening (<11h) Protection in Shifts API', () => {
  test('allows creating a closing shift (ending at 23:00)', async () => {
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-05',
        start_time: '15:00',
        end_time: '23:00',
        role: 'Server',
      });
    expect(res.status).toBe(201);
  });

  test('blocks creating an opening shift next morning (07:00) with 8h rest (<11h)', async () => {
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-06',
        start_time: '07:00',
        end_time: '15:00',
        role: 'Server',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REST_WINDOW_VIOLATION');
    expect(res.body.error).toContain('Rest window violation');
    expect(res.body.restHours).toBe(8);
  });

  test('allows creating opening shift next morning when allow_override is true', async () => {
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-06',
        start_time: '07:00',
        end_time: '15:00',
        role: 'Server',
        allow_override: true,
      });
    expect(res.status).toBe(201);
  });

  test('allows creating a shift on 2026-10-07 with >= 11 hours rest', async () => {
    // Previous shift ended at 15:00 on 2026-10-06. 10-07 at 08:00 has 17 hours rest.
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-07',
        start_time: '08:00',
        end_time: '16:00',
        role: 'Server',
      });
    expect(res.status).toBe(201);
  });

  test('blocks PUT shift update when edited time violates 11h rest', async () => {
    // Create shift on 10-08 at 12:00-20:00
    const createRes = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        schedule_id: scheduleId,
        employee_id: employeeId,
        date: '2026-10-08',
        start_time: '12:00',
        end_time: '20:00',
        role: 'Server',
      });
    expect(createRes.status).toBe(201);
    const shiftId = createRes.body.id;

    // Try to update start_time to 02:00 (which would be only 10h after 10-07 16:00)
    const updateRes = await request(app)
      .put(`/api/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        start_time: '02:00',
        end_time: '10:00',
      });
    expect(updateRes.status).toBe(400);
    expect(updateRes.body.code).toBe('REST_WINDOW_VIOLATION');

    // With allow_override: true, it succeeds
    const overrideRes = await request(app)
      .put(`/api/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        start_time: '02:00',
        end_time: '10:00',
        allow_override: true,
      });
    expect(overrideRes.status).toBe(200);
  });
});

