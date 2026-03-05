import Schedule from './models/Schedule.js';
import Shift from './models/Shift.js';
import Employee from './models/Employee.js';
import Availability from './models/Availability.js';
import Forecast from './models/Forecast.js';

function computeDayNeeds(forecast, date, dayOfWeek) {
  const revenue = forecast?.expected_revenue ?? 3000;
  let serverCount = 2, hostCount = 1, kitchenCount = 2, barCount = 1;
  if (revenue >= 8000) { serverCount = 5; kitchenCount = 4; barCount = 2; hostCount = 2; }
  else if (revenue >= 5000) { serverCount = 4; kitchenCount = 3; barCount = 2; hostCount = 1; }
  else if (revenue >= 3000) { serverCount = 3; kitchenCount = 2; barCount = 1; hostCount = 1; }
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    serverCount = Math.ceil(serverCount * 1.3);
    kitchenCount = Math.ceil(kitchenCount * 1.2);
  }
  return {
    date, dayOfWeek,
    shiftsNeeded: [
      { role: 'Server', start: '11:00', end: '19:00', count: Math.ceil(serverCount / 2) },
      { role: 'Server', start: '15:00', end: '23:00', count: Math.floor(serverCount / 2) },
      { role: 'Kitchen', start: '10:00', end: '18:00', count: Math.ceil(kitchenCount / 2) },
      { role: 'Kitchen', start: '14:00', end: '22:00', count: Math.floor(kitchenCount / 2) },
      { role: 'Bar', start: '16:00', end: '00:00', count: barCount },
      { role: 'Host', start: '11:00', end: '19:00', count: hostCount },
      { role: 'Manager', start: '09:00', end: '17:00', count: 1 },
    ],
  };
}

function parseMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isAvailable(avail, shiftStart, shiftEnd) {
  if (!avail) return false;
  const aStart = parseMinutes(avail.start_time);
  const aEnd = parseMinutes(avail.end_time);
  const sStart = parseMinutes(shiftStart);
  let sEnd = parseMinutes(shiftEnd);
  if (sEnd < sStart) sEnd += 24 * 60;
  const availEndAdj = aEnd < aStart ? aEnd + 24 * 60 : aEnd;
  return aStart <= sStart && availEndAdj >= sEnd;
}

export async function generateSchedule({ weekStart, laborBudget }) {
  const schedule = await Schedule.create({ week_start: weekStart, labor_budget: laborBudget, status: 'draft' });
  const scheduleId = schedule._id;

  const employees = await Employee.find();
  const allAvailability = await Availability.find();

  const employeeWeeklyHours = {};
  const employeeLastShiftEnd = {};
  employees.forEach(e => { employeeWeeklyHours[e._id.toString()] = 0; });

  const weekDates = [];
  const startDate = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  let totalCost = 0;
  const shiftsToInsert = [];

  for (const date of weekDates) {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    const forecast = await Forecast.findOne({ date });
    const dayNeeds = computeDayNeeds(forecast, date, dayOfWeek);

    const sorted = [...employees].sort(
      (a, b) => (employeeWeeklyHours[a._id.toString()] ?? 0) - (employeeWeeklyHours[b._id.toString()] ?? 0)
    );

    for (const need of dayNeeds.shiftsNeeded) {
      let assigned = 0;
      const s = parseMinutes(need.start);
      let e = parseMinutes(need.end);
      if (e < s) e += 24 * 60;
      const shiftHrs = (e - s) / 60;

      for (const emp of sorted) {
        if (assigned >= need.count) break;
        if (emp.role !== need.role && emp.role !== 'Manager') continue;
        if (emp.role === 'Manager' && need.role !== 'Manager') continue;

        const avail = allAvailability.find(
          a => a.employee_id.toString() === emp._id.toString() && a.day_of_week === dayOfWeek
        );
        if (!isAvailable(avail, need.start, need.end)) continue;

        const currentHours = employeeWeeklyHours[emp._id.toString()] ?? 0;
        if (currentHours + shiftHrs > emp.weekly_hours_max) continue;

        const shiftCost = emp.hourly_rate * shiftHrs;
        if (totalCost + shiftCost > laborBudget * 1.1) continue;

        const last = employeeLastShiftEnd[emp._id.toString()];
        if (last && last.date !== date) {
          const lastDateObj = new Date(last.date);
          const currDateObj = new Date(date);
          const dayDiff = (currDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24);
          if (dayDiff === 1) {
            const lastEndMin = parseMinutes(last.endTime);
            const thisStartMin = parseMinutes(need.start) + 24 * 60;
            const turnaround = (thisStartMin - lastEndMin) / 60;
            if (turnaround < 9) continue;
          }
        }

        shiftsToInsert.push({
          schedule_id: scheduleId,
          employee_id: emp._id,
          date,
          start_time: need.start,
          end_time: need.end,
          role: need.role,
          status: 'scheduled',
        });
        employeeWeeklyHours[emp._id.toString()] = currentHours + shiftHrs;
        employeeLastShiftEnd[emp._id.toString()] = { date, endTime: need.end };
        totalCost += shiftCost;
        assigned++;
      }
    }
  }

  await Shift.insertMany(shiftsToInsert);
  return scheduleId.toString();
}

export async function computeWeeklyStaffingNeeds(weekStart) {
  const suggestions = [];
  const startDate = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const date = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();
    const forecast = await Forecast.findOne({ date });
    const dayNeed = computeDayNeeds(forecast, date, dayOfWeek);
    suggestions.push({
      date,
      day_of_week: dayOfWeek,
      expected_revenue: forecast?.expected_revenue ?? 3000,
      expected_covers: forecast?.expected_covers ?? 0,
      staffing: dayNeed.shiftsNeeded,
    });
  }
  return suggestions;
}
