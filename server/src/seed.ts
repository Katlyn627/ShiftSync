import { getDb } from './db';
import bcrypt from 'bcryptjs';

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns the ISO date string (YYYY-MM-DD) for the Monday of the current week. */
function currentWeekMonday(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const daysToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  return monday.toISOString().split('T')[0];
}

/** Returns YYYY-MM-DD shifted by `days` from the given base ISO string. */
function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum weekly hours worked to create an overtime record (avoids trivial entries). */
const MIN_HOURS_FOR_OVERTIME_RECORD = 20;

// ── Main seed function ────────────────────────────────────────────────────────

export function seedDemoData(): void {
  const db = getDb();

  const existingCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  if (existingCount > 0) return; // Already seeded

  // ── 1. Sites ──────────────────────────────────────────────────────────────
  const insertSite = db.prepare(
    'INSERT INTO sites (name, city, state, timezone, site_type) VALUES (?, ?, ?, ?, ?)'
  );
  const siteResults = [
    insertSite.run('Bella Napoli',          'Chicago',  'IL', 'America/Chicago',  'restaurant'),
    insertSite.run('The Blue Door',          'Austin',   'TX', 'America/Chicago',  'restaurant'),
    insertSite.run('Grand Pacific Hotel',    'New York', 'NY', 'America/New_York', 'hotel'),
    insertSite.run('Seaside Suites & Spa',  'Miami',    'FL', 'America/New_York', 'hotel'),
  ];
  const [siteR1, siteR2, siteH1, siteH2] = siteResults.map(r => r.lastInsertRowid as number);

  // ── 2. Employees ──────────────────────────────────────────────────────────
  interface EmpSeed {
    first_name: string; last_name: string;
    role: string; role_title: string; department: string;
    hourly_rate: number; weekly_hours_max: number;
    email: string; phone: string; hire_date: string;
    site_id: number; avatar_key: string;
  }

  const employeeData: EmpSeed[] = [
    // ── Bella Napoli (restaurant, Chicago) ──────────────────────────────
    { first_name: 'Alice',  last_name: 'Johnson',  role: 'Manager',  role_title: 'General Manager',      department: 'Management',      hourly_rate: 24.0, weekly_hours_max: 45, email: 'alice.johnson@bellanapoli.com',  phone: '(312) 555-0101', hire_date: '2019-03-15', site_id: siteR1, avatar_key: 'alice_bn' },
    { first_name: 'Bob',    last_name: 'Smith',    role: 'Server',   role_title: 'Lead Server',           department: 'Front of House',  hourly_rate: 14.0, weekly_hours_max: 40, email: 'bob.smith@bellanapoli.com',      phone: '(312) 555-0102', hire_date: '2020-06-01', site_id: siteR1, avatar_key: 'bob_bn' },
    { first_name: 'Carol',  last_name: 'White',    role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.5, weekly_hours_max: 35, email: 'carol.white@bellanapoli.com',    phone: '(312) 555-0103', hire_date: '2021-09-12', site_id: siteR1, avatar_key: 'carol_bn' },
    { first_name: 'David',  last_name: 'Brown',    role: 'Kitchen',  role_title: 'Sous Chef',             department: 'Kitchen',         hourly_rate: 19.0, weekly_hours_max: 42, email: 'david.brown@bellanapoli.com',    phone: '(312) 555-0104', hire_date: '2020-01-20', site_id: siteR1, avatar_key: 'david_bn' },
    { first_name: 'Eve',    last_name: 'Davis',    role: 'Kitchen',  role_title: 'Line Cook',             department: 'Kitchen',         hourly_rate: 17.0, weekly_hours_max: 40, email: 'eve.davis@bellanapoli.com',      phone: '(312) 555-0105', hire_date: '2021-04-05', site_id: siteR1, avatar_key: 'eve_bn' },
    { first_name: 'Frank',  last_name: 'Miller',   role: 'Bar',      role_title: 'Head Bartender',        department: 'Bar',             hourly_rate: 17.5, weekly_hours_max: 40, email: 'frank.miller@bellanapoli.com',   phone: '(312) 555-0106', hire_date: '2020-11-08', site_id: siteR1, avatar_key: 'frank_bn' },
    { first_name: 'Grace',  last_name: 'Wilson',   role: 'Host',     role_title: 'Host / Cashier',        department: 'Front of House',  hourly_rate: 13.0, weekly_hours_max: 30, email: 'grace.wilson@bellanapoli.com',   phone: '(312) 555-0107', hire_date: '2022-02-14', site_id: siteR1, avatar_key: 'grace_bn' },
    { first_name: 'Henry',  last_name: 'Moore',    role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.5, weekly_hours_max: 38, email: 'henry.moore@bellanapoli.com',    phone: '(312) 555-0108', hire_date: '2022-07-19', site_id: siteR1, avatar_key: 'henry_bn' },

    // ── The Blue Door (restaurant, Austin) ──────────────────────────────
    { first_name: 'Iris',   last_name: 'Taylor',   role: 'Manager',  role_title: 'Restaurant Manager',   department: 'Management',      hourly_rate: 23.0, weekly_hours_max: 45, email: 'iris.taylor@bluedoor.com',       phone: '(512) 555-0201', hire_date: '2018-08-01', site_id: siteR2, avatar_key: 'iris_bd' },
    { first_name: 'Jack',   last_name: 'Anderson', role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.5, weekly_hours_max: 40, email: 'jack.anderson@bluedoor.com',     phone: '(512) 555-0202', hire_date: '2021-05-10', site_id: siteR2, avatar_key: 'jack_bd' },
    { first_name: 'Karen',  last_name: 'Thomas',   role: 'Server',   role_title: 'Senior Server',         department: 'Front of House',  hourly_rate: 14.5, weekly_hours_max: 40, email: 'karen.thomas@bluedoor.com',      phone: '(512) 555-0203', hire_date: '2020-03-22', site_id: siteR2, avatar_key: 'karen_bd' },
    { first_name: 'Liam',   last_name: 'Jackson',  role: 'Kitchen',  role_title: 'Prep Cook',             department: 'Kitchen',         hourly_rate: 16.0, weekly_hours_max: 40, email: 'liam.jackson@bluedoor.com',      phone: '(512) 555-0204', hire_date: '2021-10-04', site_id: siteR2, avatar_key: 'liam_bd' },
    { first_name: 'Mia',    last_name: 'Robinson', role: 'Kitchen',  role_title: 'Line Cook',             department: 'Kitchen',         hourly_rate: 17.0, weekly_hours_max: 40, email: 'mia.robinson@bluedoor.com',      phone: '(512) 555-0205', hire_date: '2022-01-17', site_id: siteR2, avatar_key: 'mia_bd' },
    { first_name: 'Noah',   last_name: 'Harris',   role: 'Bar',      role_title: 'Bartender',             department: 'Bar',             hourly_rate: 16.0, weekly_hours_max: 38, email: 'noah.harris@bluedoor.com',       phone: '(512) 555-0206', hire_date: '2021-07-30', site_id: siteR2, avatar_key: 'noah_bd' },
    { first_name: 'Olivia', last_name: 'Martin',   role: 'Host',     role_title: 'Host',                  department: 'Front of House',  hourly_rate: 12.5, weekly_hours_max: 32, email: 'olivia.martin@bluedoor.com',     phone: '(512) 555-0207', hire_date: '2023-03-06', site_id: siteR2, avatar_key: 'olivia_bd' },
    { first_name: 'Peter',  last_name: 'Clark',    role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.0, weekly_hours_max: 35, email: 'peter.clark@bluedoor.com',       phone: '(512) 555-0208', hire_date: '2022-11-28', site_id: siteR2, avatar_key: 'peter_bd' },

    // ── Grand Pacific Hotel (hotel, New York) ────────────────────────────
    { first_name: 'Quinn',  last_name: 'Lewis',    role: 'Manager',     role_title: 'Hotel General Manager',   department: 'Management',      hourly_rate: 30.0, weekly_hours_max: 45, email: 'quinn.lewis@grandpacific.com',   phone: '(212) 555-0301', hire_date: '2016-05-01', site_id: siteH1, avatar_key: 'quinn_gp' },
    { first_name: 'Rachel', last_name: 'Scott',    role: 'Front Desk',  role_title: 'Front Desk Agent',        department: 'Front Office',    hourly_rate: 18.0, weekly_hours_max: 40, email: 'rachel.scott@grandpacific.com',  phone: '(212) 555-0302', hire_date: '2020-09-14', site_id: siteH1, avatar_key: 'rachel_gp' },
    { first_name: 'Sam',    last_name: 'Turner',   role: 'Front Desk',  role_title: 'Night Auditor',           department: 'Front Office',    hourly_rate: 19.5, weekly_hours_max: 40, email: 'sam.turner@grandpacific.com',    phone: '(212) 555-0303', hire_date: '2019-12-03', site_id: siteH1, avatar_key: 'sam_gp' },
    { first_name: 'Tina',   last_name: 'Mitchell', role: 'Housekeeping', role_title: 'Room Attendant',         department: 'Housekeeping',    hourly_rate: 16.5, weekly_hours_max: 40, email: 'tina.mitchell@grandpacific.com', phone: '(212) 555-0304', hire_date: '2021-03-08', site_id: siteH1, avatar_key: 'tina_gp' },
    { first_name: 'Uma',    last_name: 'Johnson',  role: 'Housekeeping', role_title: 'Housekeeping Supervisor', department: 'Housekeeping',   hourly_rate: 20.0, weekly_hours_max: 40, email: 'uma.johnson@grandpacific.com',   phone: '(212) 555-0305', hire_date: '2018-07-22', site_id: siteH1, avatar_key: 'uma_gp' },
    { first_name: 'Victor', last_name: 'Lee',      role: 'F&B',         role_title: 'F&B Attendant',           department: 'Food & Beverage', hourly_rate: 17.0, weekly_hours_max: 38, email: 'victor.lee@grandpacific.com',    phone: '(212) 555-0306', hire_date: '2022-04-11', site_id: siteH1, avatar_key: 'victor_gp' },
    { first_name: 'Wendy',  last_name: 'Chen',     role: 'Maintenance',  role_title: 'Maintenance Technician', department: 'Engineering',     hourly_rate: 21.0, weekly_hours_max: 40, email: 'wendy.chen@grandpacific.com',    phone: '(212) 555-0307', hire_date: '2020-06-15', site_id: siteH1, avatar_key: 'wendy_gp' },
    { first_name: 'Xavier', last_name: 'Brown',    role: 'Front Desk',  role_title: 'Front Desk Supervisor',   department: 'Front Office',    hourly_rate: 22.0, weekly_hours_max: 40, email: 'xavier.brown@grandpacific.com',  phone: '(212) 555-0308', hire_date: '2019-02-28', site_id: siteH1, avatar_key: 'xavier_gp' },

    // ── Seaside Suites & Spa (hotel, Miami) ──────────────────────────────
    { first_name: 'Yara',   last_name: 'Davis',    role: 'Manager',     role_title: 'Operations Manager',     department: 'Management',      hourly_rate: 28.0, weekly_hours_max: 45, email: 'yara.davis@seasidesuites.com',   phone: '(305) 555-0401', hire_date: '2017-10-10', site_id: siteH2, avatar_key: 'yara_ss' },
    { first_name: 'Zach',   last_name: 'Wilson',   role: 'Front Desk',  role_title: 'Front Desk Agent',       department: 'Front Office',    hourly_rate: 17.5, weekly_hours_max: 40, email: 'zach.wilson@seasidesuites.com',  phone: '(305) 555-0402', hire_date: '2021-01-25', site_id: siteH2, avatar_key: 'zach_ss' },
    { first_name: 'Amy',    last_name: 'Taylor',   role: 'Front Desk',  role_title: 'Night Auditor',          department: 'Front Office',    hourly_rate: 19.0, weekly_hours_max: 40, email: 'amy.taylor@seasidesuites.com',   phone: '(305) 555-0403', hire_date: '2020-08-18', site_id: siteH2, avatar_key: 'amy_ss' },
    { first_name: 'Ben',    last_name: 'Martinez', role: 'Housekeeping', role_title: 'Room Attendant',        department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 40, email: 'ben.martinez@seasidesuites.com', phone: '(305) 555-0404', hire_date: '2022-05-02', site_id: siteH2, avatar_key: 'ben_ss' },
    { first_name: 'Clara',  last_name: 'Nguyen',   role: 'Housekeeping', role_title: 'Laundry Attendant',     department: 'Housekeeping',    hourly_rate: 15.5, weekly_hours_max: 38, email: 'clara.nguyen@seasidesuites.com', phone: '(305) 555-0405', hire_date: '2023-02-07', site_id: siteH2, avatar_key: 'clara_ss' },
    { first_name: 'Dan',    last_name: 'Roberts',  role: 'F&B',         role_title: 'Poolside Server',        department: 'Food & Beverage', hourly_rate: 15.0, weekly_hours_max: 38, email: 'dan.roberts@seasidesuites.com',  phone: '(305) 555-0406', hire_date: '2022-03-14', site_id: siteH2, avatar_key: 'dan_ss' },
    { first_name: 'Elena',  last_name: 'Kim',      role: 'Maintenance',  role_title: 'Facilities Technician', department: 'Engineering',     hourly_rate: 20.5, weekly_hours_max: 40, email: 'elena.kim@seasidesuites.com',    phone: '(305) 555-0407', hire_date: '2021-11-09', site_id: siteH2, avatar_key: 'elena_ss' },
    { first_name: 'Felix',  last_name: 'Garcia',   role: 'F&B',         role_title: 'Banquet Server',         department: 'Food & Beverage', hourly_rate: 15.5, weekly_hours_max: 38, email: 'felix.garcia@seasidesuites.com', phone: '(305) 555-0408', hire_date: '2023-06-20', site_id: siteH2, avatar_key: 'felix_ss' },
  ];

  const insertEmp = db.prepare(`
    INSERT INTO employees
      (name, first_name, last_name, role, role_title, department,
       hourly_rate, weekly_hours_max, email, phone, hire_date, site_id, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const emp of employeeData) {
    const name = `${emp.first_name} ${emp.last_name}`;
    const photo_url = `https://i.pravatar.cc/150?u=shiftsync_${emp.avatar_key}`;
    insertEmp.run(
      name, emp.first_name, emp.last_name, emp.role, emp.role_title, emp.department,
      emp.hourly_rate, emp.weekly_hours_max, emp.email, emp.phone, emp.hire_date,
      emp.site_id, photo_url
    );
  }

  // ── 3. Availability ──────────────────────────────────────────────────────
  const insertAvail = db.prepare(
    "INSERT OR REPLACE INTO availability (employee_id, day_of_week, start_time, end_time, availability_type) VALUES (?, ?, ?, ?, 'specific')"
  );

  const allEmps = db.prepare('SELECT id FROM employees').all() as any[];
  for (const emp of allEmps) {
    for (let day = 0; day <= 6; day++) {
      const startHour = (day === 0 || day === 6) ? '09:00' : '07:00';
      // Some employees have a fixed day off
      if (emp.id % 5 === 0 && day === 1) continue; // off Mondays
      if (emp.id % 7 === 0 && day === 3) continue; // off Wednesdays
      insertAvail.run(emp.id, day, startHour, '23:59');
    }
  }

  // ── 4. Forecasts (prior week + current week) ──────────────────────────
  const thisMonday = currentWeekMonday();
  const lastMonday = addDays(thisMonday, -7);

  const insertForecast = db.prepare(
    'INSERT OR REPLACE INTO forecasts (date, expected_revenue, expected_covers) VALUES (?, ?, ?)'
  );

  // Deterministic revenue by day-of-week offset from Monday (0=Mon … 6=Sun)
  const revenueByOffset = [3800, 3200, 4200, 4500, 6200, 7500, 7000];

  for (let w = 0; w < 2; w++) {
    const weekStart = w === 0 ? lastMonday : thisMonday;
    for (let d = 0; d < 7; d++) {
      const dateStr = addDays(weekStart, d);
      const revenue = revenueByOffset[d] + (w === 0 ? -200 : 200);
      const covers = Math.floor(revenue / 32);
      insertForecast.run(dateStr, revenue, covers);
    }
  }

  // ── 5. Schedules (2 per site) ────────────────────────────────────────────
  const budgetBySite: Record<number, number> = {
    [siteR1]: 4500, [siteR2]: 4200, [siteH1]: 8500, [siteH2]: 8000,
  };
  const insertSchedule = db.prepare(
    "INSERT INTO schedules (week_start, labor_budget, status, site_id) VALUES (?, ?, ?, ?)"
  );

  const siteIds = [siteR1, siteR2, siteH1, siteH2];
  const scheduleIds: Record<string, number> = {};

  for (const siteId of siteIds) {
    for (const [wIdx, weekStart] of [[0, lastMonday], [1, thisMonday]] as [number, string][]) {
      const status = wIdx === 0 ? 'published' : 'draft';
      const result = insertSchedule.run(weekStart, budgetBySite[siteId], status, siteId);
      scheduleIds[`${siteId}_${weekStart}`] = result.lastInsertRowid as number;
    }
  }

  // ── 6. Employees by site ─────────────────────────────────────────────────
  const empsBySite: Record<number, any[]> = {};
  for (const siteId of siteIds) {
    empsBySite[siteId] = db.prepare('SELECT * FROM employees WHERE site_id = ?').all(siteId) as any[];
  }

  const insertShift = db.prepare(
    "INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
  );

  function empsByRole(siteId: number, role: string): any[] {
    return empsBySite[siteId].filter(e => e.role === role);
  }
  function empByRole(siteId: number, role: string): any | undefined {
    return empsBySite[siteId].find(e => e.role === role);
  }

  // ── 7. Shifts ─────────────────────────────────────────────────────────────

  function seedRestaurantWeek(siteId: number, weekStart: string) {
    const scheduleId = scheduleIds[`${siteId}_${weekStart}`];
    const mgr     = empByRole(siteId, 'Manager');
    const servers  = empsByRole(siteId, 'Server');
    const cooks    = empsByRole(siteId, 'Kitchen');
    const barStaff = empsByRole(siteId, 'Bar');
    const hosts    = empsByRole(siteId, 'Host');

    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const isWeekend = d === 4 || d === 5; // Fri/Sat (offset from Monday)

      // Manager: 09:00–17:00 every day
      if (mgr) insertShift.run(scheduleId, mgr.id, date, '09:00', '17:00', 'Manager');

      // Servers: lunch + dinner shifts
      const serverCount = isWeekend ? 3 : 2;
      for (let i = 0; i < Math.min(serverCount, servers.length); i++) {
        insertShift.run(scheduleId, servers[i % servers.length].id, date, '11:00', '15:00', 'Server');
      }
      for (let i = 0; i < Math.min(serverCount, servers.length); i++) {
        insertShift.run(scheduleId, servers[(i + 1) % servers.length].id, date, '16:00', '23:00', 'Server');
      }

      // Kitchen: day (09:00–17:00) and evening (15:00–23:00)
      if (cooks.length > 0) insertShift.run(scheduleId, cooks[0].id, date, '09:00', '17:00', 'Kitchen');
      if (cooks.length > 1) insertShift.run(scheduleId, cooks[1].id, date, '15:00', '23:00', 'Kitchen');

      // Bar: overnight on Fri/Sat
      if (barStaff.length > 0) {
        const barEnd = isWeekend ? '01:00' : '23:30';
        insertShift.run(scheduleId, barStaff[0].id, date, '17:00', barEnd, 'Bar');
      }

      // Host: daytime
      if (hosts.length > 0) insertShift.run(scheduleId, hosts[0].id, date, '11:00', '19:00', 'Host');
    }
  }

  function seedHotelWeek(siteId: number, weekStart: string) {
    const scheduleId = scheduleIds[`${siteId}_${weekStart}`];
    const mgr         = empByRole(siteId, 'Manager');
    const frontDeskAll = empsByRole(siteId, 'Front Desk');
    const houseAll     = empsByRole(siteId, 'Housekeeping');
    const fbAll        = empsByRole(siteId, 'F&B');
    const maintAll     = empsByRole(siteId, 'Maintenance');

    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);

      // Manager: 08:00–16:00
      if (mgr) insertShift.run(scheduleId, mgr.id, date, '08:00', '16:00', 'Manager');

      // Front Desk: day (07:00–15:00), evening (15:00–23:00), overnight (23:00–07:00)
      if (frontDeskAll.length > 0) insertShift.run(scheduleId, frontDeskAll[0].id, date, '07:00', '15:00', 'Front Desk');
      if (frontDeskAll.length > 1) insertShift.run(scheduleId, frontDeskAll[1].id, date, '15:00', '23:00', 'Front Desk');
      if (frontDeskAll.length > 2) insertShift.run(scheduleId, frontDeskAll[2].id, date, '23:00', '07:00', 'Front Desk');

      // Housekeeping: morning 08:00–16:00
      for (const h of houseAll) {
        insertShift.run(scheduleId, h.id, date, '08:00', '16:00', 'Housekeeping');
      }

      // F&B: breakfast (06:00–14:00) and dinner (17:00–23:00)
      if (fbAll.length > 0) insertShift.run(scheduleId, fbAll[0].id, date, '06:00', '14:00', 'F&B');
      if (fbAll.length > 1) insertShift.run(scheduleId, fbAll[1].id, date, '17:00', '23:00', 'F&B');

      // Maintenance: 08:00–16:00
      if (maintAll.length > 0) insertShift.run(scheduleId, maintAll[0].id, date, '08:00', '16:00', 'Maintenance');
    }
  }

  for (const siteId of [siteR1, siteR2]) {
    seedRestaurantWeek(siteId, lastMonday);
    seedRestaurantWeek(siteId, thisMonday);
  }
  for (const siteId of [siteH1, siteH2]) {
    seedHotelWeek(siteId, lastMonday);
    seedHotelWeek(siteId, thisMonday);
  }

  // ── 8. Overtime records for prior week ──────────────────────────────────
  const priorShifts = db.prepare(`
    SELECT s.employee_id, s.start_time, s.end_time, e.hourly_rate
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    JOIN schedules sc ON s.schedule_id = sc.id
    WHERE sc.week_start = ?
  `).all(lastMonday) as any[];

  const hoursMap: Record<number, { hours: number; rate: number }> = {};
  for (const sh of priorShifts) {
    const [shH, shM] = (sh.start_time as string).split(':').map(Number);
    const [ehH, ehM] = (sh.end_time as string).split(':').map(Number);
    let sMin = shH * 60 + shM;
    let eMin = ehH * 60 + ehM;
    if (eMin < sMin) eMin += 24 * 60; // overnight
    const hrs = (eMin - sMin) / 60;
    if (!hoursMap[sh.employee_id]) hoursMap[sh.employee_id] = { hours: 0, rate: sh.hourly_rate };
    hoursMap[sh.employee_id].hours += hrs;
  }

  const insertOT = db.prepare(`
    INSERT OR REPLACE INTO weekly_overtime
      (employee_id, week_start, regular_hours, overtime_hours, overtime_pay)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const [empIdStr, { hours, rate }] of Object.entries(hoursMap)) {
    if (hours < MIN_HOURS_FOR_OVERTIME_RECORD) continue; // skip trivial records
    const regularHours = Math.min(hours, 40);
    const overtimeHours = Math.max(0, hours - 40);
    const overtimePay = overtimeHours * rate * 1.5;
    insertOT.run(parseInt(empIdStr), lastMonday, regularHours, overtimeHours, overtimePay);
  }

  // ── 9. Users ─────────────────────────────────────────────────────────────
  const insertUser = db.prepare(
    'INSERT OR IGNORE INTO users (username, password_hash, employee_id, is_manager) VALUES (?, ?, ?, ?)'
  );
  const allSeeded = db.prepare('SELECT id, role, first_name FROM employees').all() as any[];
  const usedUsernames = new Set<string>();

  for (const emp of allSeeded) {
    let base = String(emp.first_name).toLowerCase();
    let username = base;
    let suffix = 2;
    while (usedUsernames.has(username)) { username = `${base}${suffix}`; suffix++; }
    usedUsernames.add(username);

    const hash = bcrypt.hashSync('password123', 10);
    const isManager = emp.role === 'Manager' ? 1 : 0;
    insertUser.run(username, hash, emp.id, isManager);
  }

  // ── 10. Shift swap requests ───────────────────────────────────────────────
  const insertSwap = db.prepare(
    'INSERT INTO shift_swaps (shift_id, requester_id, target_id, reason, status, manager_notes) VALUES (?, ?, ?, ?, ?, ?)'
  );

  function getShiftFor(scheduleId: number, employeeId: number): any | undefined {
    return db.prepare(
      "SELECT * FROM shifts WHERE schedule_id = ? AND employee_id = ? AND status = 'scheduled' LIMIT 1"
    ).get(scheduleId, employeeId) as any;
  }

  // Bella Napoli – current week
  const r1Curr = scheduleIds[`${siteR1}_${thisMonday}`];
  const r1Prev = scheduleIds[`${siteR1}_${lastMonday}`];
  const r1Servers = empsByRole(siteR1, 'Server');
  const r1Cooks   = empsByRole(siteR1, 'Kitchen');
  const r1Bar     = empsByRole(siteR1, 'Bar');

  // Pending: Server Bob ↔ Server Carol
  if (r1Servers.length >= 2) {
    const shift = getShiftFor(r1Curr, r1Servers[0].id);
    if (shift) insertSwap.run(shift.id, r1Servers[0].id, r1Servers[1].id,
      'Family event — can Carol cover my Tuesday lunch?', 'pending', null);
  }
  // Approved: Cook David ↔ Cook Eve (prior week)
  if (r1Cooks.length >= 2) {
    const shift = getShiftFor(r1Prev, r1Cooks[0].id);
    if (shift) {
      db.prepare("UPDATE shifts SET status='swapped', employee_id=? WHERE id=?").run(r1Cooks[1].id, shift.id);
      insertSwap.run(shift.id, r1Cooks[0].id, r1Cooks[1].id,
        'Doctor appointment in the morning.', 'approved',
        'Approved — Eve confirmed availability. Please log clock-in.');
    }
  }
  // Denied: Bar Frank open swap
  if (r1Bar.length > 0) {
    const shift = getShiftFor(r1Curr, r1Bar[0].id);
    if (shift) insertSwap.run(shift.id, r1Bar[0].id, null,
      'Need this Saturday off — personal reasons.', 'rejected',
      'Denied — no available coverage on short notice.');
  }

  // The Blue Door – current week pending
  const r2Curr = scheduleIds[`${siteR2}_${thisMonday}`];
  const r2Servers = empsByRole(siteR2, 'Server');
  if (r2Servers.length >= 2) {
    const shift = getShiftFor(r2Curr, r2Servers[1].id);
    if (shift) insertSwap.run(shift.id, r2Servers[1].id, r2Servers[0].id,
      'Class schedule conflict on Wednesday.', 'pending', null);
  }

  // Grand Pacific – approved & pending
  const h1Curr = scheduleIds[`${siteH1}_${thisMonday}`];
  const h1FD    = empsByRole(siteH1, 'Front Desk');
  const h1House = empsByRole(siteH1, 'Housekeeping');
  if (h1FD.length >= 2) {
    const shift = getShiftFor(h1Curr, h1FD[0].id);
    if (shift) {
      db.prepare("UPDATE shifts SET status='swapped', employee_id=? WHERE id=?").run(h1FD[1].id, shift.id);
      insertSwap.run(shift.id, h1FD[0].id, h1FD[1].id,
        'Attending a training seminar all day.', 'approved',
        'Approved — Xavier confirmed. Updated roster accordingly.');
    }
  }
  if (h1House.length > 0) {
    const shift = getShiftFor(h1Curr, h1House[0].id);
    if (shift) insertSwap.run(shift.id, h1House[0].id, null,
      'Medical appointment that cannot be rescheduled.', 'pending', null);
  }

  // Seaside – denied
  const h2Curr = scheduleIds[`${siteH2}_${thisMonday}`];
  const h2FD   = empsByRole(siteH2, 'Front Desk');
  if (h2FD.length >= 2) {
    const shift = getShiftFor(h2Curr, h2FD[0].id);
    if (shift) insertSwap.run(shift.id, h2FD[0].id, h2FD[1].id,
      'Personal commitment — can Amy cover?', 'rejected',
      'Denied — Amy is already at max hours this week.');
  }

  // ── 11. Sanity validation ─────────────────────────────────────────────────
  validateSeedData();
}

/** Lightweight runtime checks confirming seed integrity. Throws on failure. */
export function validateSeedData(): void {
  const db = getDb();

  const siteCount = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as any).c;
  if (siteCount < 4) throw new Error(`Seed validation: expected ≥ 4 sites, found ${siteCount}`);

  const empCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  if (empCount < 30) throw new Error(`Seed validation: expected ≥ 30 employees, found ${empCount}`);

  const sitesWithNoEmp = db.prepare(`
    SELECT s.id, s.name FROM sites s
    LEFT JOIN employees e ON e.site_id = s.id
    GROUP BY s.id HAVING COUNT(e.id) = 0
  `).all() as any[];
  if (sitesWithNoEmp.length > 0) {
    throw new Error(`Seed validation: sites with no employees: ${sitesWithNoEmp.map((s: any) => s.name).join(', ')}`);
  }

  const schedulesWithNoShifts = db.prepare(`
    SELECT sc.id FROM schedules sc
    LEFT JOIN shifts sh ON sh.schedule_id = sc.id
    GROUP BY sc.id HAVING COUNT(sh.id) = 0
  `).all() as any[];
  if (schedulesWithNoShifts.length > 0) {
    throw new Error(`Seed validation: ${schedulesWithNoShifts.length} schedule(s) have no shifts`);
  }

  const invalidSwaps = db.prepare(`
    SELECT sw.id FROM shift_swaps sw
    LEFT JOIN shifts s ON sw.shift_id = s.id
    LEFT JOIN employees req ON sw.requester_id = req.id
    WHERE s.id IS NULL OR req.id IS NULL
  `).all() as any[];
  if (invalidSwaps.length > 0) {
    throw new Error(`Seed validation: ${invalidSwaps.length} swap(s) reference invalid shifts/employees`);
  }

  const swapStatuses = new Set(
    (db.prepare('SELECT DISTINCT status FROM shift_swaps').all() as any[]).map(s => s.status)
  );
  if (!swapStatuses.has('pending') || !swapStatuses.has('approved') || !swapStatuses.has('rejected')) {
    throw new Error(`Seed validation: missing swap statuses; found: ${[...swapStatuses].join(', ')}`);
  }

  console.log(
    `✓ Seed validation passed — ${siteCount} sites, ${empCount} employees, ` +
    `all schedules have shifts, swap statuses OK`
  );
}
