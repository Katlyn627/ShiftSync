import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import shiftsRouter from '../routes/shifts';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-shifts-drop.db');

let app: express.Express;
let staffToken: string;
let managerToken: string;
let bobShiftId: number;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/shifts', shiftsRouter);

  const staffRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'bob', password: 'password123' });
  staffToken = staffRes.body.token;

  const managerRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: 'password123' });
  managerToken = managerRes.body.token;

  const bob = db.prepare('SELECT id FROM employees WHERE first_name = ? ORDER BY id LIMIT 1').get('Bob') as { id: number };
  const shift = db.prepare('SELECT id FROM shifts WHERE employee_id = ? ORDER BY date, start_time LIMIT 1').get(bob.id) as { id: number };
  bobShiftId = shift.id;
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

test('employee can submit a drop request without server error', async () => {
  const res = await request(app)
    .post(`/api/shifts/${bobShiftId}/drop`)
    .set('Authorization', `Bearer ${staffToken}`)
    .send({ reason: 'family emergency' });

  expect(res.status).toBe(201);
  expect(res.body.swap).toBeDefined();
});

test('manager can submit a drop request without server error', async () => {
  const db = getDb();
  const anotherShift = db.prepare('SELECT id FROM shifts WHERE employee_id != (SELECT id FROM employees WHERE first_name = ?) ORDER BY id DESC LIMIT 1').get('Bob') as { id: number };

  const res = await request(app)
    .post(`/api/shifts/${anotherShift.id}/drop`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ reason: 'manager initiated drop' });

  expect(res.status).toBe(201);
  expect(res.body.swap).toBeDefined();
});
