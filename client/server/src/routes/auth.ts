import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db';
import { getJwtSecret, requireAuth, AuthUser } from '../middleware/auth';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function issueToken(user: AuthUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: '7d' });
}

function upsertUser(
  provider: string,
  providerUserId: string,
  email: string | null,
  displayName: string,
  role?: string,
  employeeId?: number | null
): AuthUser {
  const db = getDb();
  const existing = db.prepare(
    'SELECT * FROM users WHERE provider=? AND provider_user_id=?'
  ).get(provider, providerUserId) as any;

  if (existing) {
    return {
      userId: existing.id,
      role: existing.role,
      employeeId: existing.employee_id,
      displayName: existing.display_name,
    };
  }

  const result = db.prepare(
    'INSERT INTO users (provider, provider_user_id, email, display_name, employee_id, role) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(provider, providerUserId, email, displayName, employeeId ?? null, role ?? 'employee');

  return {
    userId: result.lastInsertRowid as number,
    role: (role ?? 'employee') as 'manager' | 'employee',
    employeeId: employeeId ?? null,
    displayName,
  };
}

// POST /api/auth/demo-login  { type: 'manager' | 'employee' }
router.post('/demo-login', (req: Request, res: Response) => {
  const { type } = req.body;
  if (type !== 'manager' && type !== 'employee') {
    res.status(400).json({ error: 'type must be "manager" or "employee"' });
    return;
  }

  const db = getDb();
  const demoUser = db.prepare(
    "SELECT * FROM users WHERE provider='demo' AND provider_user_id=?"
  ).get(type) as any;

  if (!demoUser) {
    res.status(500).json({ error: 'Demo user not seeded. Run server to seed demo data.' });
    return;
  }

  const authUser: AuthUser = {
    userId: demoUser.id,
    role: demoUser.role,
    employeeId: demoUser.employee_id,
    displayName: demoUser.display_name,
  };

  const token = issueToken(authUser);
  res.json({ token, user: authUser });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout  (stateless JWT - just confirm on client side)
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

// ─── Google OAuth ────────────────────────────────────────────────────────────

router.get('/google', (req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(501).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
    return;
  }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
    return;
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) {
      res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
      return;
    }
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userRes.json() as any;
    const user = upsertUser('google', profile.id, profile.email, profile.name || profile.email);
    const token = issueToken(user);
    res.redirect(`${FRONTEND_URL}/login?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[auth] Google callback error:', err);
    res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
  }
});

// ─── Microsoft OAuth ──────────────────────────────────────────────────────────

router.get('/microsoft', (req: Request, res: Response) => {
  if (!process.env.MICROSOFT_CLIENT_ID) {
    res.status(501).json({ error: 'Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.' });
    return;
  }
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    redirect_uri: `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/microsoft/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    response_mode: 'query',
  });
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  res.redirect(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`);
});

router.get('/microsoft/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code || !process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    res.redirect(`${FRONTEND_URL}/login?error=microsoft_not_configured`);
    return;
  }
  try {
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/microsoft/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) {
      res.redirect(`${FRONTEND_URL}/login?error=microsoft_auth_failed`);
      return;
    }
    const userRes = await fetch('https://graph.microsoft.com/oidc/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userRes.json() as any;
    const sub = profile.sub || profile.id || tokenData.id_token;
    const user = upsertUser('microsoft', sub, profile.email, profile.name || profile.preferred_username || 'Microsoft User');
    const token = issueToken(user);
    res.redirect(`${FRONTEND_URL}/login?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[auth] Microsoft callback error:', err);
    res.redirect(`${FRONTEND_URL}/login?error=microsoft_auth_failed`);
  }
});

export default router;
