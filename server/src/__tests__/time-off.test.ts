import path from 'path';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import employeesRouter from '../routes/employees';
import timeOffRouter from '../routes/time-off';
import express from 'express';
import request from 'supertest';

process.env.DB_PATH = path.join('/tmp', 'test-time-off.db');

let app: express.Express;
let managerToken: string;
let staffToken: string;
let staffEmployeeId: number;

// A date that is >= 14 days from now
function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  const fs = require('fs');
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  getDb();
  seedDemoData();
  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/time-off', timeOffRouter);

  const managerRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: 'password123' });
  managerToken = managerRes.body.token;

  const staffRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'bob', password: 'password123' });
  staffToken = staffRes.body.token;
  staffEmployeeId = staffRes.body.user.employeeId;
});

afterAll(() => {
  closeDb();
  const fs = require('fs');
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('GET /api/time-off', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/time-off');
    expect(res.status).toBe(401);
  });

  test('employee can fetch their own requests (empty initially)', async () => {
    const res = await request(app)
      .get('/api/time-off')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('manager can fetch all requests', async () => {
    const res = await request(app)
      .get('/api/time-off')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/time-off', () => {
  test('rejects request with start_date less than 2 weeks away', async () => {
    const res = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ start_date: futureDate(3), end_date: futureDate(5), reason: 'vacation' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2 weeks/i);
  });

  test('rejects request where end_date is before start_date', async () => {
    const res = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ start_date: futureDate(20), end_date: futureDate(16) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/end_date/i);
  });

  test('successfully creates a time-off request with >= 2 weeks notice', async () => {
    const start = futureDate(15);
    const end = futureDate(17);
    const res = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ start_date: start, end_date: end, reason: 'family trip' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.start_date).toBe(start);
    expect(res.body.end_date).toBe(end);
    expect(res.body.employee_name).toBeDefined();
  });

  test('rejects request with missing fields', async () => {
    const res = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ start_date: futureDate(14) });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/time-off/:id/approve and /reject', () => {
  let requestId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ start_date: futureDate(15), end_date: futureDate(18), reason: 'test' });
    requestId = res.body.id;
  });

  test('employee cannot approve time-off requests', async () => {
    const res = await request(app)
      .put(`/api/time-off/${requestId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  test('manager can approve a time-off request', async () => {
    const res = await request(app)
      .put(`/api/time-off/${requestId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'Approved!' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.manager_notes).toBe('Approved!');
  });
});

describe('DELETE /api/time-off/:id', () => {
  let requestId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ start_date: futureDate(20), end_date: futureDate(22) });
    requestId = res.body.id;
  });

  test('employee can cancel their own pending request', async () => {
    const res = await request(app)
      .delete(`/api/time-off/${requestId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for already deleted request', async () => {
    const res = await request(app)
      .delete(`/api/time-off/${requestId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(404);
  });
});
