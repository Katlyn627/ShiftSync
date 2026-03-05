import Employee from './models/Employee.js';
import Shift from './models/Shift.js';

const CLOPEN_THRESHOLD_HOURS = 10;
const LATE_NIGHT_CUTOFF = 22 * 60;

function parseMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftHours(start, end) {
  const startMin = parseMinutes(start);
  let endMin = parseMinutes(end);
  if (endMin < startMin) endMin += 24 * 60;
  return (endMin - startMin) / 60;
}

function isLateNight(startTime, endTime) {
  const endMin = parseMinutes(endTime);
  const startMin = parseMinutes(startTime);
  return endMin < startMin || endMin >= LATE_NIGHT_CUTOFF;
}

export async function calculateBurnoutRisks(scheduleId) {
  const employees = await Employee.find();
  const shifts = await Shift.find({
    schedule_id: scheduleId,
    status: { $ne: 'cancelled' }
  }).sort({ employee_id: 1, date: 1, start_time: 1 });

  const results = [];

  for (const emp of employees) {
    const empShifts = shifts.filter(s => s.employee_id.toString() === emp._id.toString());
    if (empShifts.length === 0) continue;

    const factors = [];
    let riskScore = 0;

    const weeklyHours = empShifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0);

    if (weeklyHours > emp.weekly_hours_max) {
      factors.push(`Overtime: ${weeklyHours.toFixed(1)}h (max ${emp.weekly_hours_max}h)`);
      riskScore += Math.min(40, (weeklyHours - emp.weekly_hours_max) * 5);
    } else if (weeklyHours > emp.weekly_hours_max * 0.9) {
      factors.push(`Near max hours: ${weeklyHours.toFixed(1)}h`);
      riskScore += 10;
    }

    const workDays = [...new Set(empShifts.map(s => s.date))].sort();
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
    if (maxConsecutive >= 6) { factors.push(`${maxConsecutive} consecutive days`); riskScore += 30; }
    else if (maxConsecutive >= 5) { factors.push(`${maxConsecutive} consecutive days`); riskScore += 15; }
    else if (maxConsecutive >= 4) { factors.push(`${maxConsecutive} consecutive days`); riskScore += 5; }

    const shiftsByDay = {};
    for (const s of empShifts) {
      shiftsByDay[s.date] = shiftsByDay[s.date] || [];
      shiftsByDay[s.date].push(s);
    }
    const doublesCount = Object.values(shiftsByDay).filter(d => d.length >= 2).length;
    if (doublesCount > 0) {
      factors.push(`${doublesCount} double shift${doublesCount > 1 ? 's' : ''}`);
      riskScore += doublesCount * 15;
    }

    let clopenCount = 0;
    for (let i = 0; i < empShifts.length - 1; i++) {
      const curr = empShifts[i];
      const next = empShifts[i + 1];
      const currDate = new Date(curr.date);
      const nextDate = new Date(next.date);
      const dayDiff = (nextDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff === 1) {
        const currEndMin = parseMinutes(curr.end_time);
        const nextStartMin = parseMinutes(next.start_time) + 24 * 60;
        const turnaroundHours = (nextStartMin - currEndMin) / 60;
        if (turnaroundHours < CLOPEN_THRESHOLD_HOURS) clopenCount++;
      }
    }
    if (clopenCount > 0) {
      factors.push(`${clopenCount} clopen${clopenCount > 1 ? 's' : ''} (short turnaround)`);
      riskScore += clopenCount * 20;
    }

    const lateNightCount = empShifts.filter(s => isLateNight(s.start_time, s.end_time)).length;
    if (lateNightCount >= 4) { factors.push(`${lateNightCount} late-night shifts`); riskScore += 20; }
    else if (lateNightCount >= 2) { factors.push(`${lateNightCount} late-night shifts`); riskScore += 10; }

    const riskLevel = riskScore >= 50 ? 'high' : riskScore >= 20 ? 'medium' : 'low';
    const restDaysRecommended = riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 1 : 0;

    results.push({
      employee_id: emp._id.toString(),
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
