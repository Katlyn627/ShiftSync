import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import openShiftsRouter from '../routes/openShifts';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-open-shifts-eligibility.db');

let app: express.Express;
let managerToken: string;
let employeeToken: string;
let scheduleId: number;
let serverEmpId: number;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/open-shifts', openShiftsRouter);

  // Login as manager (alice)
  const managerLogin = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'password123' });
  managerToken = managerLogin.body.token;

  // Bob is seeded as Server employee
  const empLogin = await request(app).post('/api/auth/login').send({ username: 'bob', password: 'password123' });
  employeeToken = empLogin.body.token;

  const serverEmp = db.prepare("SELECT id, name FROM employees WHERE first_name = 'Bob' ORDER BY id LIMIT 1").get() as { id: number; name: string };
  serverEmpId = serverEmp.id;

  const sched = db.prepare('SELECT id FROM schedules ORDER BY id LIMIT 1').get() as { id: number };
  scheduleId = sched.id;

  // Clear existing shifts for Bob so he starts with a clean slate (0 hours)
  db.prepare('DELETE FROM shifts WHERE schedule_id = ? AND employee_id = ?').run(scheduleId, serverEmpId);
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('Open Shift Marketplace Eligibility Engine', () => {
  test('attaches eligibility info on open shifts for employee', async () => {
    const db = getDb();
    // Create an open shift for Server with no required certs
    const os = db.prepare(`
      INSERT INTO open_shifts (schedule_id, date, start_time, end_time, role, required_certifications, status)
      VALUES (?, '2026-11-02', '10:00', '16:00', 'Server', '[]', 'open')
    `).run(scheduleId);

    const res = await request(app)
      .get('/api/open-shifts')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    const target = res.body.find((s: any) => s.id === os.lastInsertRowid);
    expect(target).toBeDefined();
    expect(target.eligibility).toBeDefined();
    expect(target.eligibility.eligible).toBe(true);
    expect(target.eligibility.reasons).toEqual([]);
  });

  test('flags role mismatch when employee has different role', async () => {
    const db = getDb();
    // Create an open shift for Line Cook
    const os = db.prepare(`
      INSERT INTO open_shifts (schedule_id, date, start_time, end_time, role, required_certifications, status)
      VALUES (?, '2026-11-03', '10:00', '16:00', 'Line Cook', '[]', 'open')
    `).run(scheduleId);

    const res = await request(app)
      .get(`/api/open-shifts/${os.lastInsertRowid}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.eligibility.eligible).toBe(false);
    expect(res.body.eligibility.reasons[0]).toContain('Role mismatch');

    // Attempting to offer should be blocked with 400
    const offerRes = await request(app)
      .post(`/api/open-shifts/${os.lastInsertRowid}/offer`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(offerRes.status).toBe(400);
    expect(offerRes.body.code).toBe('INELIGIBLE_FOR_OPEN_SHIFT');
  });

  test('flags missing certification requirement', async () => {
    const db = getDb();
    // Worker does not have 'Sommelier' cert
    const os = db.prepare(`
      INSERT INTO open_shifts (schedule_id, date, start_time, end_time, role, required_certifications, status)
      VALUES (?, '2026-11-04', '10:00', '16:00', 'Server', '["Sommelier"]', 'open')
    `).run(scheduleId);

    const res = await request(app)
      .get(`/api/open-shifts/${os.lastInsertRowid}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.eligibility.eligible).toBe(false);
    expect(res.body.eligibility.reasons[0]).toContain('Missing required certification(s): Sommelier');
  });

  test('flags rest window violation (<11h)', async () => {
    const db = getDb();
    // Schedule an existing shift closing at 23:00 on 2026-11-05
    db.prepare(`
      INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status)
      VALUES (?, ?, '2026-11-05', '15:00', '23:00', 'Server', 'scheduled')
    `).run(scheduleId, serverEmpId);

    // Open shift starts at 07:00 next day (8h rest)
    const os = db.prepare(`
      INSERT INTO open_shifts (schedule_id, date, start_time, end_time, role, required_certifications, status)
      VALUES (?, '2026-11-06', '07:00', '15:00', 'Server', '[]', 'open')
    `).run(scheduleId);

    const res = await request(app)
      .get(`/api/open-shifts/${os.lastInsertRowid}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.eligibility.eligible).toBe(false);
    expect(res.body.eligibility.reasons.some((r: string) => r.includes('Rest window violation'))).toBe(true);
  });

  test('allows offer submission when employee is eligible', async () => {
    const db = getDb();
    const os = db.prepare(`
      INSERT INTO open_shifts (schedule_id, date, start_time, end_time, role, required_certifications, status)
      VALUES (?, '2026-11-10', '10:00', '16:00', 'Server', '[]', 'open')
    `).run(scheduleId);

    const res = await request(app)
      .post(`/api/open-shifts/${os.lastInsertRowid}/offer`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });
});
