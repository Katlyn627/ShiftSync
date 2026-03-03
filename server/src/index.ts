import express from 'express';
import cors from 'cors';
import { getDb } from './db';
import { seedDemoData } from './seed';
import employeesRouter from './routes/employees';
import schedulesRouter from './routes/schedules';
import shiftsRouter from './routes/shifts';
import swapsRouter from './routes/swaps';
import forecastsRouter from './routes/forecasts';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Init DB
getDb();
seedDemoData();

// Routes
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
