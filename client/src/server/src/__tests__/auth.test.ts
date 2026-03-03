import express from 'express';
import request from 'supertest';
import fs from 'fs';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import path from 'path';

process.env.DB_PATH = path.join('/tmp', 'test-auth.db');
process.env.JWT_SECRET = 'test-secret';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

beforeAll(() => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  getDb();
  seedDemoData();
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('POST /api/auth/demo-login', () => {
  it('returns a token and manager user for type=manager', async () => {
    const res = await request(app)
      .post('/api/auth/demo-login')
      .send({ type: 'manager' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('manager');
    expect(res.body.user.displayName).toBe('Alice Johnson (Manager)');
    expect(res.body.user.employeeId).toBeGreaterThan(0);
  });

  it('returns a token and employee user for type=employee', async () => {
    const res = await request(app)
      .post('/api/auth/demo-login')
      .send({ type: 'employee' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('employee');
    expect(res.body.user.displayName).toBe('Bob Smith (Employee)');
    expect(res.body.user.employeeId).toBeGreaterThan(0);
  });

  it('returns 400 for an invalid type', async () => {
    const res = await request(app)
      .post('/api/auth/demo-login')
      .send({ type: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type must be/);
  });

  it('returns 400 when type is missing', async () => {
    const res = await request(app)
      .post('/api/auth/demo-login')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user info when a valid token is provided', async () => {
    const loginRes = await request(app)
      .post('/api/auth/demo-login')
      .send({ type: 'manager' });
    const { token } = loginRes.body;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('manager');
  });
});

describe('seedDemoData', () => {
  it('creates a manager demo user linked to Alice Johnson', () => {
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE provider='demo' AND provider_user_id='manager'").get() as any;
    expect(user).toBeDefined();
    expect(user.role).toBe('manager');
    expect(user.display_name).toBe('Alice Johnson (Manager)');
    expect(user.employee_id).toBeGreaterThan(0);
  });

  it('creates an employee demo user linked to Bob Smith', () => {
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE provider='demo' AND provider_user_id='employee'").get() as any;
    expect(user).toBeDefined();
    expect(user.role).toBe('employee');
    expect(user.display_name).toBe('Bob Smith (Employee)');
    expect(user.employee_id).toBeGreaterThan(0);
  });

  it('seeds employees into the database', () => {
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
    expect(count).toBeGreaterThan(0);
  });

  it('does not duplicate demo users when called twice', () => {
    seedDemoData();
    const db = getDb();
    const count = (db.prepare("SELECT COUNT(*) as c FROM users WHERE provider='demo'").get() as any).c;
    expect(count).toBe(2);
  });
});
