import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import fairnessRouter from '../routes/fairness';
import schedulesRouter from '../routes/schedules';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-fairness.db');

let app: express.Express;
let managerToken: string;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/fairness', fairnessRouter);
  app.use('/api/schedules', schedulesRouter);

  // Login as GII CEO
  const managerLogin = await request(app).post('/api/auth/login').send({ username: 'gii_ceo', password: 'password123' });
  managerToken = managerLogin.body.token;
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('Fairness & Instability API', () => {
  test('GET /api/fairness returns workforce fairness report with role stats and flags', async () => {
    const res = await request(app)
      .get('/api/fairness')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.employees).toBeDefined();
    expect(res.body.role_stats).toBeDefined();
    expect(Array.isArray(res.body.employees)).toBe(true);
    expect(Array.isArray(res.body.role_stats)).toBe(true);
    expect(res.body.summary.total_employees).toBeGreaterThan(0);
  });

  test('GET /api/fairness/instability returns schedule instability metrics', async () => {
    const res = await request(app)
      .get('/api/fairness/instability')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const first = res.body[0];
    expect(first.schedule_id).toBeDefined();
    expect(first.instability_score).toBeDefined();
    expect(first.instability_level).toBeDefined();
  });

  test('GET /api/schedules/:id/burnout-risks calculates schedule risks', async () => {
    const db = getDb();
    const sched = db.prepare('SELECT id FROM schedules ORDER BY id LIMIT 1').get() as { id: number };

    const res = await request(app)
      .get(`/api/schedules/${sched.id}/burnout-risks`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const first = res.body[0];
    expect(first.employee_id).toBeDefined();
    expect(first.risk_level).toBeDefined();
    expect(first.risk_score).toBeDefined();
  });
});

