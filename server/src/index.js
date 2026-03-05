import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { connectDb } from './db.js';
import { seedDemoData } from './seed.js';
import authRouter from './routes/auth.js';
import employeesRouter from './routes/employees.js';
import schedulesRouter from './routes/schedules.js';
import shiftsRouter from './routes/shifts.js';
import swapsRouter from './routes/swaps.js';
import forecastsRouter from './routes/forecasts.js';
import timeOffRouter from './routes/time-off.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'shiftsync-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);
app.use(passport.initialize());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

connectDb()
  .then(() => seedDemoData())
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/swaps', swapsRouter);
app.use('/api/forecasts', forecastsRouter);
app.use('/api/time-off', timeOffRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ShiftSync server running on http://localhost:${PORT}`);
});

export default app;
