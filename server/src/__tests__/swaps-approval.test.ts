import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import swapsRouter from '../routes/swaps';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-swaps-approval.db');

let app: express.Express;
let employeeToken: string;
let managerToken: string;
let requesterId: number;
let targetId: number;
let shiftId: number;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/swaps', swapsRouter);

  const employeeLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'bob', password: 'password123' });
  employeeToken = employeeLogin.body.token;

  const managerLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: 'password123' });
  managerToken = managerLogin.body.token;

  const requester = db.prepare('SELECT id, site_id FROM employees WHERE first_name = ? ORDER BY id LIMIT 1').get('Bob') as { id: number; site_id: number } | undefined;
  expect(requester).toBeDefined();
  if (!requester) {
    throw new Error('Seed data missing Bob employee record');
  }

  const target = db.prepare(
    `SELECT id FROM employees
     WHERE site_id = ? AND id != ? AND role = ?
     ORDER BY id LIMIT 1`
  ).get(requester.site_id, requester.id, 'Server') as { id: number } | undefined;
  expect(target).toBeDefined();
  if (!target) {
    throw new Error('Seed data missing same-site server target for swap approval test');
  }

  const shift = db.prepare('SELECT id FROM shifts WHERE employee_id = ? ORDER BY date, start_time LIMIT 1').get(requester.id) as { id: number } | undefined;
  expect(shift).toBeDefined();
  if (!shift) {
    throw new Error('Seed data missing shift assigned to requester for swap approval test');
  }

  requesterId = requester.id;
  targetId = target.id;
  shiftId = shift.id;
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

test('approving swap reassigns shift employee for schedule sync', async () => {
  const createSwapRes = await request(app)
    .post('/api/swaps')
    .set('Authorization', `Bearer ${employeeToken}`)
    .send({
      shift_id: shiftId,
      requester_id: requesterId,
      target_id: targetId,
      reason: 'Need coverage',
    });

  expect(createSwapRes.status).toBe(201);
  const swapId = createSwapRes.body.id;

  const approveRes = await request(app)
    .put(`/api/swaps/${swapId}/approve`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ manager_notes: 'Approved' });

  expect(approveRes.status).toBe(200);
  expect(approveRes.body.status).toBe('approved');

  const db = getDb();
  const updatedShift = db.prepare('SELECT employee_id, status FROM shifts WHERE id = ?').get(shiftId) as { employee_id: number; status: string };
  expect(updatedShift.employee_id).toBe(targetId);
  expect(updatedShift.status).toBe('swapped');
});
