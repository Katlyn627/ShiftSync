import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { getDb } from './db';
import { seedDemoData } from './seed';
import authRouter from './routes/auth';
import employeesRouter from './routes/employees';
import schedulesRouter from './routes/schedules';
import shiftsRouter from './routes/shifts';
import swapsRouter from './routes/swaps';
import forecastsRouter from './routes/forecasts';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
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

// Init DB
getDb();
seedDemoData();

// Routes
app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/swaps', swapsRouter);
app.use('/api/forecasts', forecastsRouter);

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
});

export default app;