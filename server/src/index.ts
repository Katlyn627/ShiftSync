// Must be the very first import so that dotenv populates process.env before
// any other module reads environment variables at module-initialisation time.
import './env';
import path from 'path';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { getDb } from './db';
import { seedDemoData } from './seed';
import authRouter from './routes/auth';
import employeesRouter from './routes/employees';
import schedulesRouter from './routes/schedules';
import shiftsRouter from './routes/shifts';
import sitesRouter from './routes/sites';
import positionsRouter from './routes/positions';
import openShiftsRouter from './routes/openShifts';
import swapsRouter from './routes/swaps';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, same-origin server requests)
    if (!origin) return callback(null, true);
    // Allow Capacitor / Ionic native app origins
    if (origin === 'capacitor://localhost' || origin === 'ionic://localhost' || origin === 'http://localhost') {
      return callback(null, true);
    }
    // Allow the configured client URL
    const CLIENT_URL = process.env.CLIENT_URL || '';
    if (CLIENT_URL && origin === CLIENT_URL) return callback(null, true);
    // Allow any localhost/127.0.0.1 port in development
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // In production, reject any other origin
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
    }
    // Development fallback: allow all
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

// Session required for the OAuth state parameter (stateless JWT is issued at callback)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'shiftsync-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax', // mitigates CSRF for the OAuth state cookie
    },
  })
);
app.use(passport.initialize());

// Rate limiting: 300 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Readiness flag: flipped to true after DB init and seeding complete.
// API routes (except /api/health) return 503 until the app is ready so that
// Cloud Run does not route traffic to an uninitialised instance.
let appReady = false;
app.use('/api', (req, res, next) => {
  if (!appReady && req.path !== '/health') {
    res.status(503).json({ error: 'Service is starting up, please retry shortly.' });
    return;
  }
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/open-shifts', openShiftsRouter);
app.use('/api/swaps', swapsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve built React frontend in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
// SPA fallback: serve index.html for all non-API routes so React Router works
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ShiftSync server running on http://localhost:${PORT}`);
  // Init DB and seed after the port is open so that Cloud Run's startup probe
  // succeeds before the (potentially long) synchronous seeding begins.
  getDb();
  seedDemoData();
  appReady = true;
});

export default app;
