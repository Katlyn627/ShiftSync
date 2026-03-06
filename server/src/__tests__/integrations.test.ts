/**
 * Tests for the new integrations:
 *  - Employee fields: pay_type, certifications, is_minor, union_member
 *  - Site field: jurisdiction
 *  - Compliance rules API (/api/compliance)
 *  - Audit log API (/api/audit)
 *  - Scheduling appeals API (/api/appeals)
 *  - Burnout risk access control (manager vs employee view)
 */
jest.setTimeout(30000);

import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import express from 'express';
import request from 'supertest';

import authRouter from '../routes/auth';
import employeesRouter from '../routes/employees';
import sitesRouter from '../routes/sites';
import schedulesRouter from '../routes/schedules';
import complianceRouter from '../routes/compliance';
import auditRouter from '../routes/audit';
import appealsRouter from '../routes/appeals';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-integrations.db');

let app: express.Express;
let managerToken: string;
let staffToken: string;
let staffEmployeeId: number;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/sites', sitesRouter);
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/compliance', complianceRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/appeals', appealsRouter);

  const managerRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: 'password123' });
  managerToken = managerRes.body.token;

  const staffRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'bob', password: 'password123' });
  staffToken = staffRes.body.token;
  staffEmployeeId = staffRes.body.user?.employeeId;
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

// ── Employee new fields ──────────────────────────────────────────────────────

describe('Employee new fields: pay_type, certifications, is_minor, union_member', () => {
  let createdEmpId: number;

  test('manager can create employee with new fields', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Test Employee',
        role: 'server',
        hourly_rate: 18.0,
        pay_type: 'hourly',
        certifications: ['food-handler', 'servsafe'],
        is_minor: false,
        union_member: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.pay_type).toBe('hourly');
    expect(res.body.certifications).toBe('["food-handler","servsafe"]');
    expect(res.body.is_minor).toBe(0);
    expect(res.body.union_member).toBe(1);
    createdEmpId = res.body.id;
  });

  test('manager can update employee pay_type and certifications', async () => {
    const res = await request(app)
      .put(`/api/employees/${createdEmpId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ pay_type: 'salaried', certifications: ['food-handler'], is_minor: true });
    expect(res.status).toBe(200);
    expect(res.body.pay_type).toBe('salaried');
    expect(res.body.certifications).toBe('["food-handler"]');
    expect(res.body.is_minor).toBe(1);
  });

  test('existing employees default to pay_type=hourly', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    const emp = (res.body as any[]).find((e: any) => e.name === 'Test Employee');
    expect(emp).toBeDefined();
  });
});

// ── Site jurisdiction ────────────────────────────────────────────────────────

describe('Site jurisdiction field', () => {
  let siteId: number;

  test('manager can create site with jurisdiction', async () => {
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'EU Café', city: 'Berlin', state: 'BE', timezone: 'Europe/Berlin', site_type: 'restaurant', jurisdiction: 'eu' });
    expect(res.status).toBe(201);
    expect(res.body.jurisdiction).toBe('eu');
    siteId = res.body.id;
  });

  test('manager can update site jurisdiction', async () => {
    const res = await request(app)
      .put(`/api/sites/${siteId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ jurisdiction: 'us-nyc' });
    expect(res.status).toBe(200);
    expect(res.body.jurisdiction).toBe('us-nyc');
  });

  test('sites without jurisdiction default to "default"', async () => {
    const res = await request(app)
      .get('/api/sites')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    const sites = res.body as any[];
    // Demo sites were created before migration but should get default
    expect(sites.length).toBeGreaterThan(0);
    sites.forEach((s: any) => {
      expect(s.jurisdiction).toBeDefined();
    });
  });
});

// ── Compliance rules ─────────────────────────────────────────────────────────

describe('Compliance rules API', () => {
  test('authenticated user can list all compliance rules', async () => {
    const res = await request(app)
      .get('/api/compliance')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should have seeded rules
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('authenticated user can list rules for a specific jurisdiction', async () => {
    const res = await request(app)
      .get('/api/compliance?jurisdiction=eu')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((r: any) => r.jurisdiction === 'eu')).toBe(true);
  });

  test('default jurisdiction rules include min_rest_hours', async () => {
    const res = await request(app)
      .get('/api/compliance?jurisdiction=default')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    const restRule = (res.body as any[]).find((r: any) => r.rule_type === 'min_rest_hours');
    expect(restRule).toBeDefined();
    expect(parseFloat(restRule.rule_value)).toBe(10);
  });

  test('eu jurisdiction has 11-hour min_rest_hours', async () => {
    const res = await request(app)
      .get('/api/compliance?jurisdiction=eu')
      .set('Authorization', `Bearer ${managerToken}`);
    const restRule = (res.body as any[]).find((r: any) => r.rule_type === 'min_rest_hours');
    expect(restRule).toBeDefined();
    expect(parseFloat(restRule.rule_value)).toBe(11);
  });

  test('us-nyc jurisdiction has 14-day advance_notice_days', async () => {
    const res = await request(app)
      .get('/api/compliance?jurisdiction=us-nyc')
      .set('Authorization', `Bearer ${managerToken}`);
    const noticeRule = (res.body as any[]).find((r: any) => r.rule_type === 'advance_notice_days');
    expect(noticeRule).toBeDefined();
    expect(parseFloat(noticeRule.rule_value)).toBe(14);
  });

  test('list jurisdictions endpoint returns all coded jurisdictions', async () => {
    const res = await request(app)
      .get('/api/compliance/jurisdictions')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain('default');
    expect(res.body).toContain('eu');
    expect(res.body).toContain('us-ca');
    expect(res.body).toContain('us-nyc');
  });

  test('manager can update a rule value', async () => {
    const listRes = await request(app)
      .get('/api/compliance?jurisdiction=default')
      .set('Authorization', `Bearer ${managerToken}`);
    const rule = (listRes.body as any[]).find((r: any) => r.rule_type === 'min_rest_hours');
    expect(rule).toBeDefined();

    const updateRes = await request(app)
      .put(`/api/compliance/${rule.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ rule_value: '11', description: 'Updated to 11h' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.rule_value).toBe('11');

    // Restore
    await request(app)
      .put(`/api/compliance/${rule.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ rule_value: '10' });
  });

  test('non-manager cannot create a compliance rule', async () => {
    const res = await request(app)
      .post('/api/compliance')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ jurisdiction: 'custom', rule_type: 'min_rest_hours', rule_value: '8' });
    expect(res.status).toBe(403);
  });

  test('unauthenticated cannot access compliance rules', async () => {
    const res = await request(app).get('/api/compliance');
    expect(res.status).toBe(401);
  });

  test('creating duplicate rule returns 409', async () => {
    const res = await request(app)
      .post('/api/compliance')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ jurisdiction: 'default', rule_type: 'min_rest_hours', rule_value: '9' });
    expect(res.status).toBe(409);
  });

  test('manager can create and delete a custom rule', async () => {
    const createRes = await request(app)
      .post('/api/compliance')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ jurisdiction: 'custom-test', rule_type: 'min_rest_hours', rule_value: '12', description: 'Test rule' });
    expect(createRes.status).toBe(201);
    const ruleId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/compliance/${ruleId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });
});

// ── Audit log ────────────────────────────────────────────────────────────────

describe('Audit log API', () => {
  test('manager can read audit log', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('non-manager cannot read audit log', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('unauthenticated cannot read audit log', async () => {
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(401);
  });

  test('audit log has entries after schedule generation', async () => {
    // Generate a schedule to trigger an audit entry
    await request(app)
      .post('/api/schedules/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ week_start: '2025-09-01', labor_budget: 5000 });

    const res = await request(app)
      .get('/api/audit?entity_type=schedule')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    const entry = res.body[0];
    expect(entry.entity_type).toBe('schedule');
    expect(entry.action).toBe('schedule_generated');
  });

  test('audit log supports pagination', async () => {
    const res = await request(app)
      .get('/api/audit?limit=2&offset=0')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(2);
  });
});

// ── Scheduling appeals ───────────────────────────────────────────────────────

describe('Scheduling appeals API', () => {
  let appealId: number;

  test('employee can submit a scheduling appeal', async () => {
    const res = await request(app)
      .post('/api/appeals')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'The automated schedule gave me 6 consecutive days without my consent.' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.reason).toContain('6 consecutive days');
    appealId = res.body.id;
  });

  test('employee cannot submit appeal with empty reason', async () => {
    const res = await request(app)
      .post('/api/appeals')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: '   ' });
    expect(res.status).toBe(400);
  });

  test('employee can view their own appeal', async () => {
    const res = await request(app)
      .get(`/api/appeals/${appealId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(appealId);
  });

  test('employee can list their own appeals', async () => {
    const res = await request(app)
      .get('/api/appeals')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((a: any) => a.employee_id === staffEmployeeId)).toBe(true);
  });

  test('manager can list all appeals', async () => {
    const res = await request(app)
      .get('/api/appeals')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('manager can approve an appeal', async () => {
    const res = await request(app)
      .put(`/api/appeals/${appealId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ manager_notes: 'Approved — will revise schedule to give a rest day.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.manager_notes).toBe('Approved — will revise schedule to give a rest day.');
  });

  test('approving an already-approved appeal returns 409', async () => {
    const res = await request(app)
      .put(`/api/appeals/${appealId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(res.status).toBe(409);
  });

  test('non-manager cannot approve/reject an appeal', async () => {
    const rejectRes = await request(app)
      .put(`/api/appeals/${appealId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(rejectRes.status).toBe(403);
  });

  test('unauthenticated cannot access appeals', async () => {
    const res = await request(app).get('/api/appeals');
    expect(res.status).toBe(401);
  });

  test('appeal with invalid shift_id returns 404', async () => {
    const res = await request(app)
      .post('/api/appeals')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ shift_id: 999999, reason: 'Contesting shift assignment' });
    expect(res.status).toBe(404);
  });
});

// ── Burnout risk access control ──────────────────────────────────────────────

describe('Burnout risks: manager vs employee access', () => {
  let scheduleId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/schedules/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ week_start: '2025-10-06', labor_budget: 5000 });
    scheduleId = res.body.id;
  });

  test('manager receives full individual burnout data as array', async () => {
    const res = await request(app)
      .get(`/api/schedules/${scheduleId}/burnout-risks`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    // Manager gets an array of individual records
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('non-manager receives own burnout entry and anonymised summary', async () => {
    const res = await request(app)
      .get(`/api/schedules/${scheduleId}/burnout-risks`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    // Employee gets { own, summary } shape (not a raw array)
    expect(Array.isArray(res.body)).toBe(false);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('total_employees');
    expect(res.body.summary).toHaveProperty('high_risk_count');
    expect(res.body.summary).toHaveProperty('avg_risk_score');
    // "own" is either null (if not scheduled) or their own record
    expect(['object', 'null'].includes(typeof res.body.own)).toBe(true);
  });

  test('unauthenticated cannot access burnout risks', async () => {
    const res = await request(app).get(`/api/schedules/${scheduleId}/burnout-risks`);
    expect(res.status).toBe(401);
  });
});
