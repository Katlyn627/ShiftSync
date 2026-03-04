import { getDb } from './db';
import { BurnoutRisk } from './types';

const CLOPEN_THRESHOLD_HOURS = 10; // if gap between end and next start < 10h => clopen
const LATE_NIGHT_CUTOFF = 22 * 60; // shifts ending at or after 22:00 are late-night

function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftHours(start: string, end: string): number {
  const startMin = parseMinutes(start);
  let endMin = parseMinutes(end);
  if (endMin < startMin) endMin += 24 * 60; // overnight
  return (endMin - startMin) / 60;
}

function isLateNight(startTime: string, endTime: string): boolean {
  const endMin = parseMinutes(endTime);
  const startMin = parseMinutes(startTime);
  // overnight shifts (end < start) always run into late night; also direct late-night end
  return endMin < startMin || endMin >= LATE_NIGHT_CUTOFF;
}

export function calculateBurnoutRisks(scheduleId: number): BurnoutRisk[] {
  const db = getDb();

  const employees = db.prepare('SELECT * FROM employees').all() as any[];
  const shifts = db.prepare(
    'SELECT s.*, e.name as employee_name, e.hourly_rate FROM shifts s JOIN employees e ON s.employee_id = e.id WHERE s.schedule_id = ? AND s.status != ? ORDER BY s.employee_id, s.date, s.start_time'
  ).all(scheduleId, 'cancelled') as any[];

  const results: BurnoutRisk[] = [];

  for (const emp of employees) {
    const empShifts = shifts.filter((s: any) => s.employee_id === emp.id);
    if (empShifts.length === 0) continue;

    const factors: string[] = [];
    let riskScore = 0;

    // Calculate weekly hours
    const weeklyHours = empShifts.reduce((sum: number, s: any) => sum + shiftHours(s.start_time, s.end_time), 0);
    
    // Check overtime
    if (weeklyHours > emp.weekly_hours_max) {
      factors.push(`Overtime: ${weeklyHours.toFixed(1)}h (max ${emp.weekly_hours_max}h)`);
      riskScore += Math.min(40, (weeklyHours - emp.weekly_hours_max) * 5);
    } else if (weeklyHours > emp.weekly_hours_max * 0.9) {
      factors.push(`Near max hours: ${weeklyHours.toFixed(1)}h`);
      riskScore += 10;
    }

    // Check consecutive days
    const workDays = [...new Set(empShifts.map((s: any) => s.date))].sort() as string[];
    let maxConsecutive = 1;
    let currentConsecutive = 1;
    for (let i = 1; i < workDays.length; i++) {
      const prev = new Date(workDays[i - 1]);
      const curr = new Date(workDays[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }
    if (maxConsecutive >= 6) {
      factors.push(`${maxConsecutive} consecutive days`);
      riskScore += 30;
    } else if (maxConsecutive >= 5) {
      factors.push(`${maxConsecutive} consecutive days`);
      riskScore += 15;
    } else if (maxConsecutive >= 4) {
      factors.push(`${maxConsecutive} consecutive days`);
      riskScore += 5;
    }

    // Check doubles (2 shifts same day)
    const shiftsByDay: Record<string, any[]> = {};
    for (const s of empShifts) {
      shiftsByDay[s.date] = shiftsByDay[s.date] || [];
      shiftsByDay[s.date].push(s);
    }
    const doublesCount = Object.values(shiftsByDay).filter((dayShifts) => dayShifts.length >= 2).length;
    if (doublesCount > 0) {
      factors.push(`${doublesCount} double shift${doublesCount > 1 ? 's' : ''}`);
      riskScore += doublesCount * 15;
    }

    // Check clopens (closing shift followed by opening shift next day)
    let clopenCount = 0;
    for (let i = 0; i < empShifts.length - 1; i++) {
      const curr = empShifts[i];
      const next = empShifts[i + 1];
      const currDate = new Date(curr.date);
      const nextDate = new Date(next.date);
      const dayDiff = (nextDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff === 1) {
        // Check turnaround time
        const currEndMin = parseMinutes(curr.end_time);
        const nextStartMin = parseMinutes(next.start_time) + 24 * 60; // next day
        const turnaroundHours = (nextStartMin - currEndMin) / 60;
        if (turnaroundHours < CLOPEN_THRESHOLD_HOURS) {
          clopenCount++;
        }
      }
    }
    if (clopenCount > 0) {
      factors.push(`${clopenCount} clopen${clopenCount > 1 ? 's' : ''} (short turnaround)`);
      riskScore += clopenCount * 20;
    }

    // Check late-night shifts (ending at or after 22:00 or overnight)
    const lateNightCount = empShifts.filter((s: any) => isLateNight(s.start_time, s.end_time)).length;
    if (lateNightCount >= 4) {
      factors.push(`${lateNightCount} late-night shifts`);
      riskScore += 20;
    } else if (lateNightCount >= 2) {
      factors.push(`${lateNightCount} late-night shifts`);
      riskScore += 10;
    }

    const riskLevel: 'low' | 'medium' | 'high' =
      riskScore >= 50 ? 'high' : riskScore >= 20 ? 'medium' : 'low';

    // Recommend rest days based on risk level and consecutive working days
    const restDaysRecommended = riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 1 : 0;

    results.push({
      employee_id: emp.id,
      employee_name: emp.name,
      risk_level: riskLevel,
      risk_score: Math.min(100, riskScore),
      factors,
      weekly_hours: Math.round(weeklyHours * 10) / 10,
      consecutive_days: maxConsecutive,
      clopens: clopenCount,
      doubles: doublesCount,
      late_night_shifts: lateNightCount,
      rest_days_recommended: restDaysRecommended,
    });
  }

  return results.sort((a, b) => b.risk_score - a.risk_score);
}
