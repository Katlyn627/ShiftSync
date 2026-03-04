import path from 'path';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import express from 'express';
import request from 'supertest';

process.env.DB_PATH = path.join('/tmp', 'test-auth.db');

let app: express.Express;

beforeAll(() => {
  const fs = require('fs');
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  getDb();
  seedDemoData();
  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
});

afterAll(() => {
  closeDb();
  const fs = require('fs');
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('POST /api/auth/login', () => {
  test('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.isManager).toBe(true);
  });

  test('logs in as employee', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.isManager).toBe(false);
    expect(res.body.user.employeeRole).toBe('Server');
  });

  test('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  test('rejects unknown user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'password123' });
    expect(res.status).toBe(401);
  });

  test('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  test('returns user for valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    const { token } = loginRes.body;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
  });

  test('rejects missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/google (unconfigured)', () => {
  test('returns 503 when Google credentials are not set', async () => {
    // GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set in the test environment
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  test('callback returns 503 when Google credentials are not set', async () => {
    const res = await request(app).get('/api/auth/google/callback');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });
});
