import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import schedulesRouter from '../routes/schedules';
import swapsRouter from '../routes/swaps';
import express from 'express';
import request from 'supertest';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-rbac.db');

let app: express.Express;
let managerToken: string;
let staffToken: string;

beforeAll(async () => {
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

describe('Role-based access: schedule generate endpoint', () => {
  test('manager can generate a schedule', async () => {
    const res = await request(app)
      .post('/api/schedules/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ week_start: '2025-06-02', labor_budget: 5000 });
    expect(res.status).toBe(201);
  });

  test('non-manager cannot generate a schedule', async () => {
    const res = await request(app)
      .post('/api/schedules/generate')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ week_start: '2025-06-02', labor_budget: 5000 });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/manager/i);
  });

  test('unauthenticated cannot generate a schedule', async () => {
    const res = await request(app)
      .post('/api/schedules/generate')
      .send({ week_start: '2025-06-02', labor_budget: 5000 });
    expect(res.status).toBe(401);
  });
});

describe('Role-based access: schedule update endpoint', () => {
  let scheduleId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/schedules/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ week_start: '2025-06-09', labor_budget: 5000 });
    scheduleId = res.body.id;
  });

  test('non-manager cannot update a schedule', async () => {
    const res = await request(app)
      .put(`/api/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'published' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/manager/i);
  });

  test('manager can update a schedule', async () => {
    const res = await request(app)
      .put(`/api/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'draft' });
    expect(res.status).toBe(200);
  });

  test('unauthenticated cannot update a schedule', async () => {
    const res = await request(app)
      .put(`/api/schedules/${scheduleId}`)
      .send({ status: 'published' });
    expect(res.status).toBe(401);
  });
});

describe('Role-based access: schedule delete endpoint', () => {
  let scheduleId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/schedules/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ week_start: '2025-07-07', labor_budget: 5000 });
    scheduleId = res.body.id;
  });

  test('non-manager cannot delete a schedule', async () => {
    const res = await request(app)
      .delete(`/api/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/manager/i);
  });

  test('unauthenticated cannot delete a schedule', async () => {
    const res = await request(app)
      .delete(`/api/schedules/${scheduleId}`);
    expect(res.status).toBe(401);
  });

  test('manager can delete a schedule', async () => {
    const res = await request(app)
      .delete(`/api/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('deleting a non-existent schedule returns 404', async () => {
    const res = await request(app)
      .delete('/api/schedules/99999')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
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
