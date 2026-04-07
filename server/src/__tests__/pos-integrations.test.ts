/**
 * Tests for POS integration routes and the schedule generate-preview endpoint.
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
import schedulesRouter from '../routes/schedules';
import posIntegrationsRouter from '../routes/pos-integrations';

process.env.DB_PATH = path.join(os.tmpdir(), 'test-pos.db');

let app: express.Express;
let managerToken: string;
let staffToken: string;

beforeAll(async () => {
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
  getDb();
  seedDemoData();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/pos-integrations', posIntegrationsRouter);

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
  try { fs.unlinkSync(process.env.DB_PATH!); } catch (_) {}
});

// ── /api/schedules/generate-preview ──────────────────────────────────────────

describe('GET /api/schedules/generate-preview', () => {
  test('requires authentication', async () => {
    const res = await request(app)
      .get('/api/schedules/generate-preview?week_start=2026-03-16');
    expect(res.status).toBe(401);
  });

  test('requires manager role', async () => {
    const res = await request(app)
      .get('/api/schedules/generate-preview?week_start=2026-03-16')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('returns 400 when week_start missing', async () => {
    const res = await request(app)
      .get('/api/schedules/generate-preview')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

  test('returns forecast and profitability preview for a valid week', async () => {
    const res = await request(app)
      .get('/api/schedules/generate-preview?week_start=2026-03-16')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    const body = res.body;

    expect(body.week_start).toBe('2026-03-16');
    expect(Array.isArray(body.forecasts)).toBe(true);
    expect(body.forecasts).toHaveLength(7);

    // Each forecast row should have the required fields
    for (const f of body.forecasts) {
      expect(f).toHaveProperty('date');
      expect(f).toHaveProperty('day_name');
      expect(typeof f.expected_revenue).toBe('number');
      expect(typeof f.expected_covers).toBe('number');
      expect(typeof f.has_data).toBe('boolean');
    }

    // Aggregate metrics
    expect(typeof body.total_expected_revenue).toBe('number');
    expect(typeof body.total_expected_covers).toBe('number');
    expect(typeof body.avg_check_per_head).toBe('number');
    expect(typeof body.table_turnover_rate).toBe('number');
    expect(typeof body.estimated_labor_cost).toBe('number');
    expect(typeof body.estimated_cogs).toBe('number');
    expect(typeof body.estimated_prime_cost).toBe('number');
    expect(typeof body.prime_cost_pct).toBe('number');
    expect(typeof body.revpash).toBe('number');
    expect(typeof body.has_forecast_data).toBe('boolean');

    // Settings should be included
    expect(body.settings).toBeDefined();
    expect(typeof body.settings.target_labor_pct).toBe('number');
    expect(typeof body.settings.cogs_pct).toBe('number');
  });

  test('has_forecast_data is true for a week with seeded data', async () => {
    // The seed populates current + prior week forecasts. Use current week.
    const today = new Date();
    const day = today.getDay();
    const daysToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday);
    const weekStart = monday.toISOString().split('T')[0];

    const res = await request(app)
      .get(`/api/schedules/generate-preview?week_start=${weekStart}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.has_forecast_data).toBe(true);
    expect(res.body.total_expected_revenue).toBeGreaterThan(0);
  });
});

// ── /api/pos-integrations ─────────────────────────────────────────────────────

describe('POS Integrations', () => {
  let integrationId: number;

  test('GET / returns empty array initially', async () => {
    const res = await request(app)
      .get('/api/pos-integrations')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET / requires manager role', async () => {
    const res = await request(app)
      .get('/api/pos-integrations')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('POST / creates a new POS integration', async () => {
    const res = await request(app)
      .post('/api/pos-integrations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ platform_name: 'toast', display_name: 'Toast - Main', api_key: 'sk-test-12345678' });

    expect(res.status).toBe(201);
    const body = res.body;
    expect(body.platform_name).toBe('toast');
    expect(body.display_name).toBe('Toast - Main');
    expect(body.status).toBe('connected');
    // API key should be masked
    expect(body.api_key_masked).not.toBe('sk-test-12345678');
    expect(body.api_key_masked).toContain('****');
    expect(body.last_synced_at).toBeNull();
    integrationId = body.id;
  });

  test('POST / rejects unsupported platform_name', async () => {
    const res = await request(app)
      .post('/api/pos-integrations')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ platform_name: 'unsupported_pos' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('platform_name must be one of');
  });

  test('GET / lists the newly created integration', async () => {
    const res = await request(app)
      .get('/api/pos-integrations')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(integrationId);
  });

  test('POST /:id/sync updates forecasts and sets last_synced_at', async () => {
    const res = await request(app)
      .post(`/api/pos-integrations/${integrationId}/sync`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.synced_dates).toBe(14); // 2 weeks × 7 days
    expect(typeof body.total_revenue_synced).toBe('number');
    expect(body.total_revenue_synced).toBeGreaterThan(0);
    expect(typeof body.total_covers_synced).toBe('number');
    // Integration record should now have last_synced_at set
    expect(body.integration.last_synced_at).not.toBeNull();
    expect(body.integration.last_sync_status).toBe('success');
  });

  test('generate-preview shows pos_last_synced after a recent sync', async () => {
    const today = new Date();
    const day = today.getDay();
    const daysToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday);
    const weekStart = monday.toISOString().split('T')[0];

    const res = await request(app)
      .get(`/api/schedules/generate-preview?week_start=${weekStart}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    // pos_last_synced should now be set since we just synced
    expect(res.body.pos_last_synced).not.toBeNull();
    expect(res.body.pos_last_synced.platform).toBe('toast');
  });

  test('DELETE /:id removes the integration', async () => {
    const res = await request(app)
      .delete(`/api/pos-integrations/${integrationId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET / no longer lists the deleted integration', async () => {
    const res = await request(app)
      .get('/api/pos-integrations')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((p: any) => p.id);
    expect(ids).not.toContain(integrationId);
  });
});

// ── Events in generate-preview ────────────────────────────────────────────────

describe('Events in generate-preview', () => {
  test('each forecast row includes an events array', async () => {
    const res = await request(app)
      .get('/api/schedules/generate-preview?week_start=2026-03-16')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    for (const f of res.body.forecasts) {
      expect(Array.isArray(f.events)).toBe(true);
    }
  });

  test('upcoming_events is an array in the response', async () => {
    const res = await request(app)
      .get('/api/schedules/generate-preview?week_start=2026-03-16')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.upcoming_events)).toBe(true);
  });

  test('a holiday week returns event labels on matching days', async () => {
    // Valentine's Day window is 02-13 to 02-15. Use week of 2026-02-09 (Mon) which includes 02-13 Fri.
    const res = await request(app)
      .get('/api/schedules/generate-preview?week_start=2026-02-09')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    // Find 2026-02-13
    const valentinesDay = res.body.forecasts.find((f: any) => f.date === '2026-02-13');
    expect(valentinesDay).toBeDefined();
    expect(valentinesDay.events).toContain("Valentine's Day");

    // upcoming_events should include the Valentine's Day entry
    const upcomingDates = res.body.upcoming_events.map((e: any) => e.date);
    expect(upcomingDates).toContain('2026-02-13');
  });

  test('a non-holiday week returns empty events arrays on all days', async () => {
    // 2026-10-19 week — falls after fall conference season (ends 10-15) and before Thanksgiving
    const res = await request(app)
      .get('/api/schedules/generate-preview?week_start=2026-10-19')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    for (const f of res.body.forecasts) {
      expect(f.events).toHaveLength(0);
    }
    expect(res.body.upcoming_events).toHaveLength(0);
  });
});

// ── POST /api/messages/broadcast ─────────────────────────────────────────────

import messagesRouter from '../routes/messages';

describe('POST /api/messages/broadcast', () => {
  beforeAll(() => {
    // Mount the messages router on the shared test app
    app.use('/api/messages', messagesRouter);
  });

  test('requires manager role', async () => {
    const res = await request(app)
      .post('/api/messages/broadcast')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ body: 'Test broadcast' });
    expect(res.status).toBe(403);
  });

  test('returns 400 when body is missing', async () => {
    const res = await request(app)
      .post('/api/messages/broadcast')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Missing body' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Message body is required');
  });

  test('creates a group conversation and returns recipient_count', async () => {
    const res = await request(app)
      .post('/api/messages/broadcast')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: '📅 Extra Coverage Needed', body: 'Large party on Saturday — please check open shifts.' });

    expect(res.status).toBe(201);
    const body = res.body;
    expect(body.conversation).toBeDefined();
    expect(body.conversation.type).toBe('group');
    expect(body.conversation.title).toBe('📅 Extra Coverage Needed');
    expect(typeof body.recipient_count).toBe('number');
    expect(body.recipient_count).toBeGreaterThan(0);
  });

  test('uses default title when none is provided', async () => {
    const res = await request(app)
      .post('/api/messages/broadcast')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ body: 'Holiday reminder — all hands on deck.' });

    expect(res.status).toBe(201);
    expect(res.body.conversation.title).toBe('📢 Staff Alert');
  });
});
