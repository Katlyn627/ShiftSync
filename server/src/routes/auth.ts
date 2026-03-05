import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'shiftsync-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable must be set in production');
  process.exit(1);
} else if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not set. Using default secret (development only).');
}

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
