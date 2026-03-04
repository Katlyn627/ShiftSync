import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getDb } from '../db';
import type { AuthPayload } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'shiftsync-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable must be set in production');
  process.exit(1);
} else if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not set. Using default secret (development only).');
}

// ── Google OAuth strategy ──────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      (_accessToken, _refreshToken, profile, done) => {
        try {
          const db = getDb();
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value ?? '';
          const displayName = profile.displayName ?? email;

          // Find by google_id first
          let user = db
            .prepare('SELECT * FROM users WHERE google_id = ?')
            .get(googleId) as any;

          if (!user) {
            // Try to match by email/username so pre-added employees can link accounts
            const candidateUsername = email.split('@')[0];
            user = db
              .prepare('SELECT * FROM users WHERE username = ?')
              .get(candidateUsername) as any;

            if (user) {
              // Link Google account to existing user
              db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
              user.google_id = googleId;
            } else {
              // The person must already exist in the employees table.
              // Find employee by display name (Google profile name).
              const employee = db
                .prepare('SELECT * FROM employees WHERE name = ?')
                .get(displayName) as any;

              if (!employee) {
                return done(null, false);
              }

              // Create user account linked to the matched employee
              const username = candidateUsername || `google_${googleId}`;
              const isManager = employee.role === 'Manager' ? 1 : 0;
              const result = db
                .prepare(
                  'INSERT INTO users (username, google_id, employee_id, is_manager) VALUES (?, ?, ?, ?)'
                )
                .run(username, googleId, employee.id, isManager);
              user = db
                .prepare('SELECT * FROM users WHERE id = ?')
                .get(result.lastInsertRowid) as any;
            }
          }

          // Attach employee details
          const emp = user.employee_id
            ? (db
                .prepare('SELECT name, role FROM employees WHERE id = ?')
                .get(user.employee_id) as any)
            : null;

          return done(null, {
            userId: user.id,
            username: user.username,
            employeeId: user.employee_id,
            isManager: user.is_manager === 1,
            employeeName: emp?.name ?? null,
            employeeRole: emp?.role ?? null,
          });
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

// ── Local login ────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT u.*, e.name as employee_name, e.role as employee_role
    FROM users u
    LEFT JOIN employees e ON u.employee_id = e.id
    WHERE u.username = ?
  `).get(username) as any;

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (!user.password_hash) {
    return res.status(401).json({ error: 'This account uses Google sign-in. Please use "Sign in with Google".' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const payload = {
    userId: user.id,
    username: user.username,
    employeeId: user.employee_id,
    isManager: user.is_manager === 1,
    employeeName: user.employee_name,
    employeeRole: user.employee_role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, user: payload });
});

// ── Register (new employee self-service) ───────────────────────────────────
// An employee must already exist in the employees table (added by a manager)
// before they can create a login account.
router.post('/register', (req, res) => {
  const { employeeName, username, password } = req.body;
  if (!employeeName || !username || !password) {
    return res.status(400).json({ error: 'employeeName, username, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const db = getDb();

  // Only allow registration for employees added by a manager
  const employee = db
    .prepare('SELECT * FROM employees WHERE name = ?')
    .get(employeeName) as any;
  if (!employee) {
    return res.status(403).json({
      error: 'No employee record found with that name. Ask your manager to add you first.',
    });
  }

  // Prevent duplicate user account for the same employee
  const existingUser = db
    .prepare('SELECT id FROM users WHERE employee_id = ?')
    .get(employee.id) as any;
  if (existingUser) {
    return res.status(409).json({ error: 'A login account already exists for this employee.' });
  }

  // Ensure username is unique
  const takenUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as any;
  if (takenUsername) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const isManager = employee.role === 'Manager' ? 1 : 0;
  const result = db
    .prepare('INSERT INTO users (username, password_hash, employee_id, is_manager) VALUES (?, ?, ?, ?)')
    .run(username, hash, employee.id, isManager);

  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as any;

  const payload = {
    userId: newUser.id,
    username: newUser.username,
    employeeId: newUser.employee_id,
    isManager: newUser.is_manager === 1,
    employeeName: employee.name,
    employeeRole: employee.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(201).json({ token, user: payload });
});

// ── Google OAuth routes ────────────────────────────────────────────────────
const googleNotConfigured = (_req: import('express').Request, res: import('express').Response) => {
  res.status(503).json({ error: 'Google OAuth is not configured on this server.' });
};

router.get(
  '/google',
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? passport.authenticate('google', { scope: ['profile', 'email'], session: false })
    : googleNotConfigured
);

router.get(
  '/google/callback',
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? (req, res, next) => {
        passport.authenticate('google', { session: false }, (err: Error | null, userPayload: AuthPayload | false) => {
          const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
          if (err || !userPayload) {
            return res.redirect(
              `${CLIENT_URL}/login?error=${encodeURIComponent('Google sign-in failed. You must be an existing employee.')}`
            );
          }
          const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
          res.redirect(`${CLIENT_URL}/login?token=${encodeURIComponent(token)}`);
        })(req, res, next);
      }
    : googleNotConfigured
);

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    res.json({ user: payload });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;

