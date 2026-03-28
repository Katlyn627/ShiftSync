import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getDb } from '../db';
import type { AuthPayload } from '../middleware/auth';

// Default positions per industry (mirrors the frontend INDUSTRIES definitions)
const INDUSTRY_DEFAULT_POSITIONS: Record<string, string[]> = {
  restaurant: [
    'General Manager', 'Assistant Manager', 'Executive Chef', 'Sous Chef',
    'Line Cook', 'Prep Cook', 'Dishwasher', 'Server', 'Lead Server',
    'Bartender', 'Barback', 'Host', 'Busser',
  ],
  hotel: [
    'General Manager', 'Front Desk Supervisor', 'Front Desk Agent', 'Night Auditor',
    'Concierge', 'Housekeeping Supervisor', 'Room Attendant', 'Laundry Attendant',
    'Maintenance Technician', 'Security Officer', 'Bellhop', 'Valet',
  ],
  retail: [
    'Store Manager', 'Assistant Manager', 'Shift Supervisor', 'Sales Associate',
    'Cashier', 'Stock Associate', 'Inventory Clerk', 'Loss Prevention Officer',
    'Visual Merchandiser', 'Customer Service Rep',
  ],
  healthcare: [
    'Medical Director', 'Physician', 'Registered Nurse', 'Licensed Practical Nurse',
    'Medical Assistant', 'Receptionist', 'Medical Records Clerk', 'Pharmacy Technician',
    'Lab Technician', 'Physical Therapist',
  ],
  fitness: [
    'Gym Manager', 'Personal Trainer', 'Group Fitness Instructor', 'Front Desk Associate',
    'Membership Advisor', 'Maintenance Technician', 'Childcare Attendant',
  ],
  salon_spa: [
    'Salon Manager', 'Hair Stylist', 'Colorist', 'Esthetician',
    'Nail Technician', 'Massage Therapist', 'Receptionist', 'Shampoo Assistant',
  ],
  warehouse: [
    'Warehouse Manager', 'Shift Supervisor', 'Warehouse Associate', 'Forklift Operator',
    'Picker', 'Packer', 'Receiving Clerk', 'Shipping Clerk', 'Quality Control Inspector',
  ],
  education: [
    'Principal', 'Assistant Principal', 'Teacher', 'Teaching Assistant',
    'Substitute Teacher', 'School Counselor', 'Administrative Assistant',
    'Custodian', 'Security Guard',
  ],
  childcare: [
    'Center Director', 'Lead Teacher', 'Assistant Teacher', 'Floater',
    'Administrative Coordinator', 'Cook', 'Bus Driver',
  ],
  security: [
    'Security Director', 'Site Supervisor', 'Security Officer', 'Patrol Officer',
    'Dispatcher', 'Access Control Officer', 'Mobile Patrol Officer',
  ],
  office: [
    'Office Manager', 'Administrative Assistant', 'Receptionist', 'HR Coordinator',
    'Accounting Clerk', 'IT Support Specialist', 'Data Entry Clerk', 'Executive Assistant',
  ],
  other: ['Manager', 'Supervisor', 'Team Lead', 'Employee'],
};

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
// If GOOGLE_CALLBACK_URL is not set, use a relative path so passport derives the
// full URL from the incoming request.  This works automatically in every
// environment (local dev, staging, production) without any extra configuration.
// If you need an explicit URL (e.g. for a tunnel or non-standard host) set
// GOOGLE_CALLBACK_URL to the full absolute URL in server/.env.
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  console.log(
    '[Google OAuth] Enabled. Register the callback URL shown below as an ' +
    'Authorised redirect URI in Google Cloud Console → Credentials:\n' +
    `  Explicit URL set:  ${process.env.GOOGLE_CALLBACK_URL ? GOOGLE_CALLBACK_URL : '(none — derived from request host at runtime)'}\n` +
    '  Local dev default: http://localhost:3001/api/auth/google/callback\n' +
    '  The most common cause of Error 400: redirect_uri_mismatch is ' +
    'registering the wrong port (3000 instead of 3001) or a mismatched production URL.'
  );
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        // proxy: true tells passport-oauth2 to trust X-Forwarded-Proto so the
        // derived callback URL uses https:// when the server sits behind an
        // HTTPS reverse-proxy (Heroku, Render, AWS ALB, nginx, …).
        proxy: true,
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
                .prepare('SELECT name, role, site_id FROM employees WHERE id = ?')
                .get(user.employee_id) as any)
            : null;

          return done(null, {
            userId: user.id,
            username: user.username,
            employeeId: user.employee_id,
            isManager: user.is_manager === 1,
            employeeName: emp?.name ?? null,
            employeeRole: emp?.role ?? null,
            siteId: emp?.site_id ?? null,
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
    SELECT u.*, e.name as employee_name, e.role as employee_role, e.photo_url as employee_photo_url, e.site_id as employee_site_id
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
    photoUrl: user.employee_photo_url ?? null,
    siteId: user.employee_site_id ?? null,
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

  const hash = bcrypt.hashSync(password, Math.max(4, Math.min(31, parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10) || 10)));
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
    photoUrl: employee.photo_url ?? null,
    siteId: employee.site_id ?? null,
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

// ── Manager self-registration (creates a new business/site + manager account) ─
router.post('/register-manager', (req, res) => {
  const {
    // Business info
    businessName,
    city,
    state,
    timezone,
    industry,
    // Manager personal info
    managerName,
    username,
    password,
    // Initial positions (JSON array of role name strings)
    positions,
  } = req.body;

  if (!businessName || !city || !state || !timezone || !industry) {
    return res.status(400).json({ error: 'businessName, city, state, timezone, and industry are required' });
  }
  if (!managerName || !username || !password) {
    return res.status(400).json({ error: 'managerName, username, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const db = getDb();

  // Ensure username is unique
  const taken = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as any;
  if (taken) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const allowedIndustries = [
    'restaurant', 'hotel', 'retail', 'healthcare', 'fitness',
    'salon_spa', 'warehouse', 'education', 'childcare', 'security', 'office', 'other',
  ];
  if (!allowedIndustries.includes(industry)) {
    return res.status(400).json({ error: `industry must be one of: ${allowedIndustries.join(', ')}` });
  }

  const hash = bcrypt.hashSync(
    password,
    Math.max(4, Math.min(31, parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10) || 10))
  );

  const createAll = db.transaction(() => {
    // 1. Create site
    const siteResult = db
      .prepare(
        `INSERT INTO sites (name, city, state, timezone, site_type, jurisdiction)
         VALUES (?, ?, ?, ?, ?, 'default')`
      )
      .run(businessName, city, state, timezone, industry);
    const siteId = siteResult.lastInsertRowid as number;

    // 2. Create manager employee record
    const [firstName, ...rest] = managerName.trim().split(' ');
    const lastName = rest.join(' ');
    const empResult = db
      .prepare(
        `INSERT INTO employees (name, first_name, last_name, role, role_title, department, pay_type, hourly_rate, weekly_hours_max, site_id)
         VALUES (?, ?, ?, 'Manager', 'Manager', 'Management', 'salaried', 0, 40, ?)`
      )
      .run(managerName.trim(), firstName, lastName || '', siteId);
    const employeeId = empResult.lastInsertRowid as number;

    // 3. Create user account
    const userResult = db
      .prepare(
        'INSERT INTO users (username, password_hash, employee_id, is_manager) VALUES (?, ?, ?, 1)'
      )
      .run(username, hash, employeeId);
    const userId = userResult.lastInsertRowid as number;

    // 4. Persist positions for the site
    const positionList: string[] =
      Array.isArray(positions) && positions.length > 0
        ? positions
        : (INDUSTRY_DEFAULT_POSITIONS[industry] ?? []);
    const insertPos = db.prepare(
      'INSERT OR IGNORE INTO site_positions (site_id, name, sort_order) VALUES (?, ?, ?)'
    );
    positionList.forEach((name, idx) => insertPos.run(siteId, name, idx));

    return { siteId, employeeId, userId, positionList };
  });

  try {
    const { siteId, employeeId, userId, positionList } = createAll();

    const payload: AuthPayload = {
      userId,
      username,
      employeeId,
      isManager: true,
      employeeName: managerName.trim(),
      employeeRole: 'Manager',
      siteId,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({
      token,
      user: { ...payload, photoUrl: null },
      positions: positionList,
    });
  } catch (err: any) {
    console.error('register-manager error:', err);
    res.status(500).json({ error: 'Failed to create business account. Please try again.' });
  }
});

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    // Fetch fresh employee data (including latest photo_url and site_id)
    const db = getDb();
    const emp = payload.employeeId
      ? (db.prepare('SELECT photo_url, site_id FROM employees WHERE id = ?').get(payload.employeeId) as any)
      : null;
    res.json({ user: { ...payload, photoUrl: emp?.photo_url ?? payload.photoUrl ?? null, siteId: emp?.site_id ?? payload.siteId ?? null } });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;

