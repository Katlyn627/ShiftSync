import path from 'path';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import employeesRouter from '../routes/employees';
import express from 'express';
import request from 'supertest';

process.env.DB_PATH = path.join('/tmp', 'test-employee-auth.db');

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
  app.use('/api/employees', employeesRouter);

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

describe('Employee route auth protection', () => {
  test('unauthenticated cannot list employees', async () => {
    const res = await request(app).get('/api/employees');
    expect(res.status).toBe(401);
  });

  test('authenticated employee can list employees', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('non-manager cannot create employee', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Test User', role: 'Server' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/manager/i);
  });

  test('unauthenticated cannot create employee', async () => {
    const res = await request(app)
      .post('/api/employees')
      .send({ name: 'Test User', role: 'Server' });
    expect(res.status).toBe(401);
  });

  test('manager can create employee', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'New Employee', role: 'Server', hourly_rate: 15, weekly_hours_max: 40 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Employee');
  });

  test('non-manager cannot update employee', async () => {
    const listRes = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${staffToken}`);
    const id = listRes.body[0].id;
    const res = await request(app)
      .put(`/api/employees/${id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  test('non-manager cannot delete employee', async () => {
    const listRes = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${staffToken}`);
    const id = listRes.body[0].id;
    const res = await request(app)
      .delete(`/api/employees/${id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/register', () => {
  test('rejects registration for unknown employee', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ employeeName: 'Nobody Known', username: 'nobody', password: 'password123' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/manager/i);
  });

  test('rejects registration with missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ employeeName: 'New Employee' });
    expect(res.status).toBe(400);
  });

  test('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ employeeName: 'New Employee', username: 'newuser', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  test('manager-added employee can register', async () => {
    // First add an employee via manager
    const addRes = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Reg Test User', role: 'Host', hourly_rate: 13, weekly_hours_max: 30 });
    expect(addRes.status).toBe(201);

    // Now register
    const res = await request(app)
      .post('/api/auth/register')
      .send({ employeeName: 'Reg Test User', username: 'regtestuser', password: 'securepass' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('regtestuser');
    expect(res.body.user.employeeRole).toBe('Host');
  });

  test('cannot register twice for same employee', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ employeeName: 'Reg Test User', username: 'regtestuser2', password: 'securepass' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test('cannot reuse an existing username', async () => {
    // Add another new employee
    await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Another Employee', role: 'Bar', hourly_rate: 16, weekly_hours_max: 35 });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ employeeName: 'Another Employee', username: 'alice', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/taken/i);
  });
});
