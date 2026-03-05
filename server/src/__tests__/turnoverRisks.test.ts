import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import schedulesRouter from '../routes/schedules';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-turnover.db');

let app: express.Express;

beforeAll(() => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  db.prepare('INSERT INTO employees (id, name, role, hourly_rate, weekly_hours_max) VALUES (1, ?, ?, ?, ?)').run('Alice', 'Server', 20, 40);
  db.prepare('INSERT INTO schedules (id, week_start, labor_budget, status) VALUES (1, ?, 5000, ?)').run('2025-01-06', 'draft');
  // Insert shifts that create medium-high burnout risk (multiple shifts per day = doubles)
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (1,1,?,?,?,?)').run('2025-01-06', '09:00', '13:00', 'Server');
  db.prepare('INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role) VALUES (1,1,?,?,?,?)').run('2025-01-06', '15:00', '21:00', 'Server');

  app = express();
  app.use(express.json());
  app.use('/api/schedules', schedulesRouter);
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('GET /api/schedules/:id/turnover-risks', () => {
  test('returns an array of turnover risk objects', async () => {
    const res = await request(app).get('/api/schedules/1/turnover-risks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('each risk entry has required fields', async () => {
    const res = await request(app).get('/api/schedules/1/turnover-risks');
    expect(res.status).toBe(200);
    const risks = res.body;
    expect(risks.length).toBeGreaterThan(0);
    for (const risk of risks) {
      expect(risk).toHaveProperty('employee_id');
      expect(risk).toHaveProperty('employee_name');
      expect(risk).toHaveProperty('turnover_risk');
      expect(risk).toHaveProperty('reason');
      expect(risk).toHaveProperty('risk_score');
      expect(risk).toHaveProperty('burnout_risk');
      expect(['low', 'medium', 'high']).toContain(risk.turnover_risk);
      expect(['low', 'medium', 'high']).toContain(risk.burnout_risk);
    }
  });

  test('turnover_risk matches burnout_risk level', async () => {
    const res = await request(app).get('/api/schedules/1/turnover-risks');
    expect(res.status).toBe(200);
    for (const risk of res.body) {
      expect(risk.turnover_risk).toBe(risk.burnout_risk);
    }
  });

  test('returns empty array for schedule with no shifts', async () => {
    const db = getDb();
    db.prepare('INSERT INTO schedules (id, week_start, labor_budget, status) VALUES (99, ?, 5000, ?)').run('2025-06-01', 'draft');
    const res = await request(app).get('/api/schedules/99/turnover-risks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
