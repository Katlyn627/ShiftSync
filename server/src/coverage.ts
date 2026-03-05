import { getDb } from './db';
import { ScheduleCoverageReport, DailyCoverageReport, StandbyAssignment } from './types';

function dateToDay(date: string): number {
  return new Date(date).getDay();
}

export function getScheduleCoverageReport(scheduleId: number): ScheduleCoverageReport {
  const db = getDb();

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  // Build 7 week-dates
  const weekDates: string[] = [];
  const start = new Date(schedule.week_start);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  // Load all standbys for this schedule (joined with employee name)
  const standbys = db.prepare(`
    SELECT sa.*, e.name as employee_name
    FROM standby_assignments sa
    JOIN employees e ON sa.employee_id = e.id
    WHERE sa.schedule_id = ?
    ORDER BY sa.date, e.name
  `).all(scheduleId) as StandbyAssignment[];

  // Count regular scheduled shifts per day (non-cancelled)
  const shiftsCountByDate: Record<string, number> = {};
  const shiftRows = db.prepare(`
    SELECT date, COUNT(*) as cnt
    FROM shifts
    WHERE schedule_id = ? AND status != 'cancelled'
    GROUP BY date
  `).all(scheduleId) as Array<{ date: string; cnt: number }>;
  for (const row of shiftRows) {
    shiftsCountByDate[row.date] = row.cnt;
  }

  // Load revenue forecasts for the week
  const forecastByDate: Record<string, number> = {};
  for (const date of weekDates) {
    const f = db.prepare('SELECT expected_revenue FROM forecasts WHERE date = ?').get(date) as any;
    forecastByDate[date] = f?.expected_revenue ?? 3000;
  }

  const days: DailyCoverageReport[] = weekDates.map(date => {
    const dayStandbys = standbys.filter(s => s.date === date);
    const scheduled_count = shiftsCountByDate[date] ?? 0;
    const standby_count = dayStandbys.length;
    const expected_revenue = forecastByDate[date];

    // Determine coverage status:
    // - critical: no standbys on a high-revenue day (>=5000)
    // - at_risk:  no standbys on an average+ revenue day, or only 1 standby on very high revenue (>=7000)
    // - good:     sufficient standby coverage
    let coverage_status: 'good' | 'at_risk' | 'critical';
    if (expected_revenue >= 5000 && standby_count === 0) {
      coverage_status = 'critical';
    } else if ((expected_revenue >= 3000 && standby_count === 0) || (expected_revenue >= 7000 && standby_count < 2)) {
      coverage_status = 'at_risk';
    } else {
      coverage_status = 'good';
    }

    return {
      date,
      day_of_week: dateToDay(date),
      expected_revenue,
      scheduled_count,
      standby_count,
      standbys: dayStandbys,
      coverage_status,
    };
  });

  const total_standby_count = standbys.length;
  const days_at_risk = days.filter(d => d.coverage_status !== 'good').length;

  return {
    schedule_id: scheduleId,
    week_start: schedule.week_start,
    days,
    total_standby_count,
    days_at_risk,
  };
}
