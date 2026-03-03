import { getDb } from './db';

export function seedDemoData(): void {
  const db = getDb();

  const existingCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  if (existingCount > 0) return; // Already seeded

  // Seed employees
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
  ];

  const insertEmp = db.prepare('INSERT INTO employees (name, role, hourly_rate, weekly_hours_max) VALUES (?, ?, ?, ?)');
  
  for (const emp of employees) {
    insertEmp.run(emp.name, emp.role, emp.hourly_rate, emp.weekly_hours_max);
  }

  // Set availability for all employees (Mon-Sun, broad windows)
  const allEmps = db.prepare('SELECT id FROM employees').all() as any[];
  const insertAvail = db.prepare('INSERT OR REPLACE INTO availability (employee_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)');
  
  for (const emp of allEmps) {
    for (let day = 0; day <= 6; day++) {
      // Vary availability slightly
      const startHour = day === 0 || day === 6 ? '09:00' : '08:00';
      const endHour = '23:59';
      if (emp.id % 3 === 0 && day === 1) continue; // some employees off Monday
      if (emp.id % 4 === 0 && day === 2) continue; // some employees off Tuesday
      insertAvail.run(emp.id, day, startHour, endHour);
    }
  }

  // Seed forecasts for next 2 weeks
  const today = new Date();
  // Find next Monday
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysToMonday - 7); // current week's Monday

  const insertForecast = db.prepare('INSERT OR REPLACE INTO forecasts (date, expected_revenue, expected_covers) VALUES (?, ?, ?)');
  
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
      insertForecast.run(dateStr, revenue, covers);
    }
  }
}