import bcrypt from 'bcryptjs';
import Employee from './models/Employee.js';
import Availability from './models/Availability.js';
import Forecast from './models/Forecast.js';
import User from './models/User.js';

export async function seedDemoData() {
  const count = await Employee.countDocuments();
  if (count > 0) return; // Already seeded

  const employees = [
    { name: 'Alice Johnson', role: 'Manager', hourly_rate: 22.0, weekly_hours_max: 45 },
    { name: 'Bob Smith', role: 'Server', hourly_rate: 14.0, weekly_hours_max: 40 },
    { name: 'Carol White', role: 'Server', hourly_rate: 14.0, weekly_hours_max: 35 },
    { name: 'David Brown', role: 'Server', hourly_rate: 15.0, weekly_hours_max: 40 },
    { name: 'Eve Davis', role: 'Kitchen', hourly_rate: 17.0, weekly_hours_max: 40 },
    { name: 'Frank Miller', role: 'Kitchen', hourly_rate: 16.0, weekly_hours_max: 40 },
    { name: 'Grace Wilson', role: 'Kitchen', hourly_rate: 18.0, weekly_hours_max: 45 },
    { name: 'Henry Moore', role: 'Bar', hourly_rate: 16.0, weekly_hours_max: 40 },
    { name: 'Iris Taylor', role: 'Bar', hourly_rate: 15.0, weekly_hours_max: 35 },
    { name: 'Jack Anderson', role: 'Host', hourly_rate: 13.0, weekly_hours_max: 30 },
    { name: 'Karen Thomas', role: 'Server', hourly_rate: 14.5, weekly_hours_max: 40 },
    { name: 'Liam Jackson', role: 'Kitchen', hourly_rate: 17.5, weekly_hours_max: 40 },
    { name: 'Mia Robinson', role: 'Manager', hourly_rate: 21.0, weekly_hours_max: 45 },
    { name: 'Noah Harris', role: 'Manager', hourly_rate: 20.5, weekly_hours_max: 40 },
    { name: 'Olivia Martin', role: 'Bar', hourly_rate: 16.5, weekly_hours_max: 40 },
    { name: 'Peter Clark', role: 'Host', hourly_rate: 13.5, weekly_hours_max: 35 },
    { name: 'Quinn Lewis', role: 'Host', hourly_rate: 13.0, weekly_hours_max: 30 },
  ];

  const savedEmps = await Employee.insertMany(employees);

  // Seed availability
  const availDocs = [];
  for (const emp of savedEmps) {
    for (let day = 0; day <= 6; day++) {
      const startHour = day === 0 || day === 6 ? '09:00' : '08:00';
      const endHour = '23:59';
      const idx = savedEmps.indexOf(emp);
      if (idx % 3 === 0 && day === 1) continue;
      if (idx % 4 === 0 && day === 2) continue;
      availDocs.push({
        employee_id: emp._id,
        day_of_week: day,
        start_time: startHour,
        end_time: endHour,
      });
    }
  }
  await Availability.insertMany(availDocs);

  // Seed forecasts
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysToMonday - 7);

  const forecastDocs = [];
  for (let w = 0; w < 2; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(nextMonday);
      date.setDate(nextMonday.getDate() + w * 7 + d);
      const dateStr = date.toISOString().split('T')[0];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const revenue = isWeekend
        ? 7000 + Math.floor(Math.random() * 2000)
        : 3500 + Math.floor(Math.random() * 2000);
      const covers = Math.floor(revenue / 35);
      forecastDocs.push({ date: dateStr, expected_revenue: revenue, expected_covers: covers });
    }
  }
  for (const f of forecastDocs) {
    await Forecast.findOneAndUpdate({ date: f.date }, f, { upsert: true });
  }

  // Seed user accounts
  const hash = await bcrypt.hash('password123', 10);
  const userDocs = savedEmps.map(emp => ({
    username: emp.name.split(' ')[0].toLowerCase(),
    password_hash: hash,
    employee_id: emp._id,
    is_manager: emp.role === 'Manager',
  }));
  await User.insertMany(userDocs);

  console.log('Demo data seeded successfully');
}
