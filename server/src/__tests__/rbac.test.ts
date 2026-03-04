import path from 'path';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import schedulesRouter from '../routes/schedules';
import swapsRouter from '../routes/swaps';
import express from 'express';
import request from 'supertest';

process.env.DB_PATH = path.join('/tmp', 'test-rbac.db');

let app: express.Express;
let managerToken: string;
let staffToken: string;

beforeAll(async () => {
  const fs = require('fs');
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  getDb();
  seedDemoData();
  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/swaps', swapsRouter);

  const managerRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: 'password123' });
  managerToken = managerRes.body.token;

  const staffRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'bob', password: 'password123' });
  staffToken = staffRes.body.token;
});

afterAll(() => {
  closeDb();
  const fs = require('fs');
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('Role-based access: labor-cost endpoint', () => {
  test('manager can access labor-cost', async () => {
    // First get a schedule id
    const schedulesRes = await request(app)
      .get('/api/schedules')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(schedulesRes.status).toBe(200);
    const schedules = schedulesRes.body;
    if (schedules.length === 0) return; // skip if no schedules

    const id = schedules[0].id;
    const res = await request(app)
      .get(`/api/schedules/${id}/labor-cost`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
  });

  test('non-manager cannot access labor-cost', async () => {
    const schedulesRes = await request(app)
      .get('/api/schedules')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(schedulesRes.status).toBe(200);
    const schedules = schedulesRes.body;
    if (schedules.length === 0) return;

    const id = schedules[0].id;
    const res = await request(app)
      .get(`/api/schedules/${id}/labor-cost`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/manager/i);
  });

  test('unauthenticated cannot access labor-cost', async () => {
    const res = await request(app).get('/api/schedules/1/labor-cost');
    expect(res.status).toBe(401);
  });
});

describe('Role-based access: staffing-suggestions endpoint', () => {
  test('manager can access staffing-suggestions', async () => {
    const res = await request(app)
      .get('/api/schedules/staffing-suggestions?week_start=2025-01-06')
      .set('Authorization', `Bearer ${managerToken}`);
    expect([200, 400]).toContain(res.status); // 200 or 400 (bad week_start is fine)
  });

  test('non-manager cannot access staffing-suggestions', async () => {
    const res = await request(app)
      .get('/api/schedules/staffing-suggestions?week_start=2025-01-06')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/manager/i);
  });

  test('unauthenticated cannot access staffing-suggestions', async () => {
    const res = await request(app)
      .get('/api/schedules/staffing-suggestions?week_start=2025-01-06');
    expect(res.status).toBe(401);
  });
});

describe('Role-based access: swap approve/reject endpoints', () => {
  test('non-manager cannot approve a swap', async () => {
    const res = await request(app)
      .put('/api/swaps/1/approve')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/manager/i);
  });

  test('non-manager cannot reject a swap', async () => {
    const res = await request(app)
      .put('/api/swaps/1/reject')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/manager/i);
  });

  test('unauthenticated cannot approve a swap', async () => {
    const res = await request(app)
      .put('/api/swaps/1/approve')
      .send({});
    expect(res.status).toBe(401);
  });
});
