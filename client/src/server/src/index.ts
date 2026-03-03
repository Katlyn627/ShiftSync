import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { getDb } from './db';
import { seedDemoData } from './seed';
import authRouter from './routes/auth';
import configRouter from './routes/config';
import employeesRouter from './routes/employees';
import schedulesRouter from './routes/schedules';
import shiftsRouter from './routes/shifts';
import swapsRouter from './routes/swaps';
import forecastsRouter from './routes/forecasts';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

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
app.use('/api/config', configRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/swaps', swapsRouter);
app.use('/api/forecasts', forecastsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`ShiftSync server running on port ${PORT}`);
});

export default app;
