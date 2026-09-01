import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { getDb, closeDb } from '../db';
import { seedDemoData } from '../seed';
import authRouter from '../routes/auth';
import surveysRouter from '../routes/surveys';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-surveys.db');

let app: express.Express;
let managerToken: string;
let employeeToken: string;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  const db = getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/surveys', surveysRouter);

  // Login as GII CEO (Marcus Vance / gii_ceo)
  const managerLogin = await request(app).post('/api/auth/login').send({ username: 'gii_ceo', password: 'password123' });
  managerToken = managerLogin.body.token;

  // Login as Field Lead (Kofi Achebe / gii_fieldlead)
  const employeeLogin = await request(app).post('/api/auth/login').send({ username: 'gii_fieldlead', password: 'password123' });
  employeeToken = employeeLogin.body.token;
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

describe('Surveys API', () => {
  test('GET /api/surveys/templates returns validated templates', async () => {
    const res = await request(app)
      .get('/api/surveys/templates')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
    const instruments = res.body.map((t: any) => t.instrument);
    expect(instruments).toContain('CBI');
    expect(instruments).toContain('BAT');
    expect(instruments).toContain('OLBI');
    expect(instruments).toContain('WHO-5');
    expect(instruments).toContain('GII-HUMANITARIAN');
  });

  test('GET /api/surveys/campaigns returns campaigns with response counts', async () => {
    const res = await request(app)
      .get('/api/surveys/campaigns')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const giiCamp = res.body.find((c: any) => c.title.includes('Humanitarian'));
    expect(giiCamp).toBeDefined();
    expect(giiCamp.response_count).toBeGreaterThanOrEqual(5);
  });

  test('GET /api/surveys/campaigns/:id/results computes subscale scores and enforces privacy', async () => {
    const db = getDb();
    const camp = db.prepare("SELECT id FROM survey_campaigns WHERE title LIKE '%Humanitarian%'").get() as { id: number };
    expect(camp).toBeDefined();

    const res = await request(app)
      .get(`/api/surveys/campaigns/${camp.id}/results`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.results_available).toBe(true);
    expect(res.body.subscale_results.length).toBeGreaterThan(0);
    expect(res.body.purpose_limitation).toBeDefined();
  });

  test('GET /api/surveys/campaigns/:id/recommendations generates actionable scheduling recommendations', async () => {
    const db = getDb();
    const camp = db.prepare("SELECT id FROM survey_campaigns WHERE title LIKE '%Humanitarian%'").get() as { id: number };

    const res = await request(app)
      .get(`/api/surveys/campaigns/${camp.id}/recommendations`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.results_available).toBe(true);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });
});

