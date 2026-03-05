import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import Employee from '../models/Employee.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'shiftsync-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable must be set in production');
  process.exit(1);
} else if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not set. Using default secret (development only).');
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        proxy: true,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value ?? '';
          const displayName = profile.displayName ?? email;

          let user = await User.findOne({ google_id: googleId }).populate('employee_id');

          if (!user) {
            const candidateUsername = email.split('@')[0];
            user = await User.findOne({ username: candidateUsername }).populate('employee_id');

            if (user) {
              user.google_id = googleId;
              await user.save();
            } else {
              const employee = await Employee.findOne({ name: displayName });
              if (!employee) return done(null, false);

              const username = candidateUsername || `google_${googleId}`;
              user = await User.create({
                username,
                google_id: googleId,
                employee_id: employee._id,
                is_manager: employee.role === 'Manager',
              });
              user = await User.findById(user._id).populate('employee_id');
            }
          }

          const emp = user.employee_id;
          return done(null, {
            userId: user._id.toString(),
            username: user.username,
            employeeId: emp ? emp._id.toString() : null,
            isManager: user.is_manager,
            employeeName: emp?.name ?? null,
            employeeRole: emp?.role ?? null,
          });
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = await User.findOne({ username }).populate('employee_id');
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  if (!user.password_hash) {
    return res.status(401).json({ error: 'This account uses Google sign-in.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  const emp = user.employee_id;
  const payload = {
    userId: user._id.toString(),
    username: user.username,
    employeeId: emp ? emp._id.toString() : null,
    isManager: user.is_manager,
    employeeName: emp?.name ?? null,
    employeeRole: emp?.role ?? null,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, user: payload });
});

router.post('/register', async (req, res) => {
  const { employeeName, username, password } = req.body;
  if (!employeeName || !username || !password) {
    return res.status(400).json({ error: 'employeeName, username, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const employee = await Employee.findOne({ name: employeeName });
  if (!employee) {
    return res.status(403).json({
      error: 'No employee record found with that name. Ask your manager to add you first.',
    });
  }

  const existingUser = await User.findOne({ employee_id: employee._id });
  if (existingUser) {
    return res.status(409).json({ error: 'A login account already exists for this employee.' });
  }

  const takenUsername = await User.findOne({ username });
  if (takenUsername) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const newUser = await User.create({
    username,
    password_hash: hash,
    employee_id: employee._id,
    is_manager: employee.role === 'Manager',
  });

  const payload = {
    userId: newUser._id.toString(),
    username: newUser.username,
    employeeId: employee._id.toString(),
    isManager: newUser.is_manager,
    employeeName: employee.name,
    employeeRole: employee.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(201).json({ token, user: payload });
});

const googleNotConfigured = (_req, res) => {
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
        passport.authenticate('google', { session: false }, (err, userPayload) => {
          const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
          if (err || !userPayload) {
            return res.redirect(
              `${CLIENT_URL}/login?error=${encodeURIComponent('Google sign-in failed.')}`
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
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ user: payload });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
