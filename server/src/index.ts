import dotenv from 'dotenv';
import path from 'path';
// __dirname is server/src (ts-node-dev) or server/dist (compiled), so ../
// always resolves to server/ — the directory that contains the .env file.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
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
import swapsRouter from './routes/swaps';
import forecastsRouter from './routes/forecasts';
import timeOffRouter from './routes/time-off';
import settingsRouter from './routes/settings';
import sitesRouter from './routes/sites';
import overtimeRouter from './routes/overtime';
import complianceRouter from './routes/compliance';
import auditRouter from './routes/audit';
import appealsRouter from './routes/appeals';
import openShiftsRouter from './routes/open-shifts';
import calloutsRouter from './routes/callouts';
import surveysRouter from './routes/surveys';
import featureFlagsRouter from './routes/feature-flags';
import fairnessRouter from './routes/fairness';
import changeRequestsRouter from './routes/change-requests';
import publishSlaRouter from './routes/publish-sla';
import posIntegrationsRouter from './routes/pos-integrations';
import positionsRouter from './routes/positions';
import notificationsRouter from './routes/notifications';
import messagesRouter from './routes/messages';

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
app.use('/api/time-off', timeOffRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/overtime', overtimeRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/audit', auditRouter);
app.use('/api/appeals', appealsRouter);
app.use('/api/open-shifts', openShiftsRouter);
app.use('/api/callouts', calloutsRouter);
app.use('/api/surveys', surveysRouter);
app.use('/api/feature-flags', featureFlagsRouter);
app.use('/api/fairness', fairnessRouter);
app.use('/api/change-requests', changeRequestsRouter);
app.use('/api/publish-sla', publishSlaRouter);
app.use('/api/pos-integrations', posIntegrationsRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/messages', messagesRouter);

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