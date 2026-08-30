import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import timeOffRouter from '../routes/timeOff';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-time-off.db');

let app: express.Express;
let managerToken: string;
let employeeToken: string;
let otherSiteManagerToken: string;
let employeeId: number;
let employeeSiteId: number;
let otherEmployeeId: number;
let otherEmployeeSiteId: number;

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function loginAs(username: string) {
  return request(app).post('/api/auth/login').send({ username, password: 'password123' });
}

function createRequestForEmployee(employee_id: number, status: 'pending' | 'approved' | 'rejected' = 'pending') {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO time_off_requests (employee_id, start_date, end_date, reason, status, manager_notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employee_id, addDays(20), addDays(22), 'seeded', status, status === 'pending' ? null : 'resolved');
  return Number(result.lastInsertRowid);
}

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/time-off', timeOffRouter);

  const managerLogin = await loginAs('alice');
  managerToken = managerLogin.body.token;

  const employeeLogin = await loginAs('bob');
  employeeToken = employeeLogin.body.token;

  const employee = db.prepare('SELECT id, site_id FROM employees WHERE first_name = ? ORDER BY id LIMIT 1').get('Bob') as { id: number; site_id: number } | undefined;
  if (!employee) throw new Error('Seed data missing Bob employee record');
  employeeId = employee.id;
  employeeSiteId = employee.site_id;

  const otherEmployee = db.prepare(
    'SELECT id, site_id FROM employees WHERE site_id != ? ORDER BY id LIMIT 1'
  ).get(employeeSiteId) as { id: number; site_id: number } | undefined;
  if (!otherEmployee) throw new Error('Seed data missing employee on a different site');
  otherEmployeeId = otherEmployee.id;
  otherEmployeeSiteId = otherEmployee.site_id;

  const otherManager = db.prepare(`
    SELECT u.username
    FROM users u
    JOIN employees e ON e.id = u.employee_id
    WHERE u.is_manager = 1 AND e.site_id = ?
    ORDER BY u.id
    LIMIT 1
  `).get(otherEmployeeSiteId) as { username: string } | undefined;
  if (!otherManager) throw new Error('Seed data missing manager on the other site');

  const otherManagerLogin = await loginAs(otherManager.username);
  otherSiteManagerToken = otherManagerLogin.body.token;
});

afterEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM time_off_requests').run();
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('time-off endpoint contract and auth', () => {
  test('endpoint is mounted and unauthenticated access returns 401 (not 404)', async () => {
    const res = await request(app).get('/api/time-off');
    expect(res.status).toBe(401);
  });

  test('401 unauthenticated access on mutating endpoints', async () => {
    const postRes = await request(app)
      .post('/api/time-off')
      .send({ start_date: addDays(20), end_date: addDays(22) });
    expect(postRes.status).toBe(401);

    const approveRes = await request(app)
      .put('/api/time-off/1/approve')
      .send({ manager_notes: 'ok' });
    expect(approveRes.status).toBe(401);

    const rejectRes = await request(app)
      .put('/api/time-off/1/reject')
      .send({ manager_notes: 'no' });
    expect(rejectRes.status).toBe(401);

    const deleteRes = await request(app).delete('/api/time-off/1');
    expect(deleteRes.status).toBe(401);
  });

  test('employee creates a valid request', async () => {
    const res = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        start_date: addDays(20),
        end_date: addDays(22),
        reason: 'family trip',
      });

    expect(res.status).toBe(201);
    expect(res.body.employee_id).toBe(employeeId);
    expect(res.body.employee_name).toBeDefined();
    expect(res.body.status).toBe('pending');
  });

  test('employee_id is derived from authentication, not request body', async () => {
    const res = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        employee_id: otherEmployeeId,
        start_date: addDays(18),
        end_date: addDays(19),
        reason: 'ignore injected employee',
      });

    expect(res.status).toBe(201);
    expect(res.body.employee_id).toBe(employeeId);

    const db = getDb();
    const row = db.prepare('SELECT employee_id FROM time_off_requests WHERE id = ?').get(res.body.id) as { employee_id: number };
    expect(row.employee_id).toBe(employeeId);
  });

  test('invalid or missing dates are rejected', async () => {
    const missingDates = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'missing dates' });
    expect(missingDates.status).toBe(400);

    const badFormat = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ start_date: '2026-1-1', end_date: '2026-01-05' });
    expect(badFormat.status).toBe(400);

    const impossibleDate = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ start_date: '2026-02-31', end_date: '2026-03-02' });
    expect(impossibleDate.status).toBe(400);

    const reversedRange = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ start_date: addDays(25), end_date: addDays(20) });
    expect(reversedRange.status).toBe(400);
  });

  test('enforces 14-day lead-time rule', async () => {
    const res = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        start_date: addDays(13),
        end_date: addDays(14),
      });

    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toMatch(/14 days/i);
  });

  test('validates reason and manager_notes as strings with max length', async () => {
    const badReason = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        start_date: addDays(20),
        end_date: addDays(21),
        reason: { text: 'not a string' },
      });
    expect(badReason.status).toBe(400);

    const longReason = await request(app)
      .post('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        start_date: addDays(20),
        end_date: addDays(21),
        reason: 'x'.repeat(1001),
      });
    expect(longReason.status).toBe(400);

    const requestId = createRequestForEmployee(employeeId, 'pending');
    const badNotes = await request(app)
      .put(`/api/time-off/${requestId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: ['not a string'] });
    expect(badNotes.status).toBe(400);

    const longNotes = await request(app)
      .put(`/api/time-off/${requestId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'n'.repeat(1001) });
    expect(longNotes.status).toBe(400);
  });

  test('employee lists only their own requests', async () => {
    const ownId = createRequestForEmployee(employeeId, 'pending');
    createRequestForEmployee(otherEmployeeId, 'pending');

    const res = await request(app)
      .get('/api/time-off')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((r: any) => r.id);
    expect(ids).toContain(ownId);
    expect(res.body.every((r: any) => r.employee_id === employeeId)).toBe(true);
  });

  test('manager lists only requests from their site', async () => {
    const siteOneId = createRequestForEmployee(employeeId, 'pending');
    const siteTwoId = createRequestForEmployee(otherEmployeeId, 'pending');

    const managerRes = await request(app)
      .get('/api/time-off')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(managerRes.status).toBe(200);
    const managerIds = managerRes.body.map((r: any) => r.id);
    expect(managerIds).toContain(siteOneId);
    expect(managerIds).not.toContain(siteTwoId);

    const otherManagerRes = await request(app)
      .get('/api/time-off')
      .set('Authorization', `Bearer ${otherSiteManagerToken}`);
    expect(otherManagerRes.status).toBe(200);
    const otherManagerIds = otherManagerRes.body.map((r: any) => r.id);
    expect(otherManagerIds).toContain(siteTwoId);
    expect(otherManagerIds).not.toContain(siteOneId);
  });

  test('employee cannot approve or reject requests', async () => {
    const requestId = createRequestForEmployee(employeeId, 'pending');

    const approveRes = await request(app)
      .put(`/api/time-off/${requestId}/approve`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ manager_notes: 'approve please' });
    expect(approveRes.status).toBe(403);

    const rejectRes = await request(app)
      .put(`/api/time-off/${requestId}/reject`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ manager_notes: 'reject please' });
    expect(rejectRes.status).toBe(403);
  });

  test('manager cannot act across sites', async () => {
    const requestId = createRequestForEmployee(otherEmployeeId, 'pending');

    const approveRes = await request(app)
      .put(`/api/time-off/${requestId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'cross-site' });
    expect(approveRes.status).toBe(403);

    const rejectRes = await request(app)
      .put(`/api/time-off/${requestId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'cross-site' });
    expect(rejectRes.status).toBe(403);
  });

  test('manager can approve and reject pending requests', async () => {
    const approveId = createRequestForEmployee(employeeId, 'pending');
    const rejectId = createRequestForEmployee(employeeId, 'pending');

    const approveRes = await request(app)
      .put(`/api/time-off/${approveId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'approved' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');
    expect(approveRes.body.manager_notes).toBe('approved');

    const rejectRes = await request(app)
      .put(`/api/time-off/${rejectId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'rejected' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('rejected');
    expect(rejectRes.body.manager_notes).toBe('rejected');
  });

  test('cannot transition a non-pending request', async () => {
    const resolvedId = createRequestForEmployee(employeeId, 'approved');

    const approveRes = await request(app)
      .put(`/api/time-off/${resolvedId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'again' });
    expect(approveRes.status).toBe(400);

    const rejectRes = await request(app)
      .put(`/api/time-off/${resolvedId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'again' });
    expect(rejectRes.status).toBe(400);
  });

  test('employee cancels own pending request', async () => {
    const requestId = createRequestForEmployee(employeeId, 'pending');

    const res = await request(app)
      .delete(`/api/time-off/${requestId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('employee cannot cancel another employee request or non-pending request', async () => {
    const othersPending = createRequestForEmployee(otherEmployeeId, 'pending');
    const ownResolved = createRequestForEmployee(employeeId, 'approved');

    const otherDelete = await request(app)
      .delete(`/api/time-off/${othersPending}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(otherDelete.status).toBe(403);

    const resolvedDelete = await request(app)
      .delete(`/api/time-off/${ownResolved}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(resolvedDelete.status).toBe(400);
  });

  test('manager deletes only same-site non-pending requests', async () => {
    const sameSitePending = createRequestForEmployee(employeeId, 'pending');
    const sameSiteResolved = createRequestForEmployee(employeeId, 'approved');
    const otherSiteResolved = createRequestForEmployee(otherEmployeeId, 'approved');

    const pendingDelete = await request(app)
      .delete(`/api/time-off/${sameSitePending}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(pendingDelete.status).toBe(400);

    const sameSiteDelete = await request(app)
      .delete(`/api/time-off/${sameSiteResolved}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(sameSiteDelete.status).toBe(200);
    expect(sameSiteDelete.body.success).toBe(true);

    const crossSiteDelete = await request(app)
      .delete(`/api/time-off/${otherSiteResolved}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(crossSiteDelete.status).toBe(403);
  });

  test('missing records return 404 and invalid numeric ids return 400', async () => {
    const missingApprove = await request(app)
      .put('/api/time-off/999999/approve')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'x' });
    expect(missingApprove.status).toBe(404);

    const missingReject = await request(app)
      .put('/api/time-off/999999/reject')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'x' });
    expect(missingReject.status).toBe(404);

    const missingDelete = await request(app)
      .delete('/api/time-off/999999')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(missingDelete.status).toBe(404);

    const invalidApprove = await request(app)
      .put('/api/time-off/not-a-number/approve')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'x' });
    expect(invalidApprove.status).toBe(400);

    const invalidReject = await request(app)
      .put('/api/time-off/not-a-number/reject')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'x' });
    expect(invalidReject.status).toBe(400);

    const invalidDelete = await request(app)
      .delete('/api/time-off/not-a-number')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(invalidDelete.status).toBe(400);
  });
});
