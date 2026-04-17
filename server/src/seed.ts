import { getDb } from './db';
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';

function currentWeekMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  return monday.toISOString().split('T')[0];
}

function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const MAX_EMPLOYEES = 50;
const MIN_EXPECTED_EMPLOYEES = 40;
const EXPECTED_SITE_NAMES = ['Bella Napoli', 'The Blue Door'];

function shouldReseed(db: Database.Database): boolean {
  const siteRows = db.prepare('SELECT name, site_type FROM sites').all() as { name: string; site_type: string }[];
  if (siteRows.length < EXPECTED_SITE_NAMES.length) return true;
  const siteNames = new Set(siteRows.map(r => r.name));
  if (EXPECTED_SITE_NAMES.some(n => !siteNames.has(n))) return true;
  if (siteRows.some(r => r.site_type !== 'restaurant')) return true;

  const empCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  if (empCount < MIN_EXPECTED_EMPLOYEES || empCount > MAX_EMPLOYEES) return true;

  const empsWithSite = (db.prepare('SELECT COUNT(*) as c FROM employees WHERE site_id IS NOT NULL').get() as any).c;
  if (empsWithSite !== empCount) return true;

  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  if (userCount < empCount) return true;

  const forecastsWithSite = (db.prepare('SELECT COUNT(*) as c FROM forecasts WHERE site_id IS NOT NULL').get() as any).c;
  if (forecastsWithSite < 14) return true;

  const schedulesWithSite = (db.prepare('SELECT COUNT(*) as c FROM schedules WHERE site_id IS NOT NULL').get() as any).c;
  if (schedulesWithSite < EXPECTED_SITE_NAMES.length) return true;

  return false;
}

function clearSeedData(db: Database.Database): void {
  db.exec(`
    DELETE FROM open_shift_offers;
    DELETE FROM open_shifts;
    DELETE FROM shift_swaps;
    DELETE FROM shifts;
    DELETE FROM schedules;
    DELETE FROM availability;
    DELETE FROM forecasts;
    DELETE FROM users;
    DELETE FROM employees;
    DELETE FROM site_positions;
    DELETE FROM sites;
  `);
}

interface SiteSeed {
  name: string;
  city: string;
  state: string;
  timezone: string;
  address: string;
  businessHours: string;
  employeeCapacity: number;
}

interface RoleSeed {
  role: string;
  department: string;
  count: number;
  minRate: number;
  maxRate: number;
  weeklyMax: number;
}

const SITE_SEED: SiteSeed[] = [
  {
    name: 'Bella Napoli',
    city: 'Chicago',
    state: 'IL',
    timezone: 'America/Chicago',
    address: '120 W Randolph St, Chicago, IL',
    businessHours: 'Mon-Sun 11:00-23:00',
    employeeCapacity: 24,
  },
  {
    name: 'The Blue Door',
    city: 'Austin',
    state: 'TX',
    timezone: 'America/Chicago',
    address: '410 Congress Ave, Austin, TX',
    businessHours: 'Mon-Sun 10:00-22:00',
    employeeCapacity: 24,
  },
];

const FOH_ROLES = ['Busser', 'Host', 'Server', 'Food Runner', 'Expo'];
const BOH_ROLES = ['Line Cook', 'Head Chef', 'Sous Chef', 'Dishwasher', 'Manager'];

const ROLE_PLAN: RoleSeed[] = [
  { role: 'Manager', department: 'Management', count: 2, minRate: 22, maxRate: 26, weeklyMax: 45 },
  { role: 'Head Chef', department: 'Back of House', count: 1, minRate: 23, maxRate: 27, weeklyMax: 45 },
  { role: 'Sous Chef', department: 'Back of House', count: 1, minRate: 20, maxRate: 24, weeklyMax: 42 },
  { role: 'Line Cook', department: 'Back of House', count: 4, minRate: 16, maxRate: 20, weeklyMax: 40 },
  { role: 'Dishwasher', department: 'Back of House', count: 2, minRate: 13, maxRate: 15, weeklyMax: 36 },
  { role: 'Server', department: 'Front of House', count: 7, minRate: 13, maxRate: 16, weeklyMax: 38 },
  { role: 'Host', department: 'Front of House', count: 2, minRate: 13, maxRate: 15, weeklyMax: 34 },
  { role: 'Busser', department: 'Front of House', count: 2, minRate: 12, maxRate: 14, weeklyMax: 34 },
  { role: 'Food Runner', department: 'Front of House', count: 2, minRate: 13, maxRate: 15, weeklyMax: 36 },
  { role: 'Expo', department: 'Front of House', count: 1, minRate: 15, maxRate: 18, weeklyMax: 38 },
];

function shiftWindowForRole(role: string, indexInRole: number): { start: string; end: string } {
  if (role === 'Manager') return { start: '09:00', end: '17:00' };
  if (role === 'Head Chef') return { start: '08:00', end: '16:00' };
  if (role === 'Sous Chef') return { start: '10:00', end: '18:00' };
  if (role === 'Line Cook') return indexInRole % 2 === 0 ? { start: '10:00', end: '18:00' } : { start: '14:00', end: '22:00' };
  if (role === 'Dishwasher') return { start: '15:00', end: '23:00' };
  if (role === 'Server') return indexInRole % 2 === 0 ? { start: '11:00', end: '19:00' } : { start: '15:00', end: '23:00' };
  if (role === 'Host') return { start: '10:00', end: '18:00' };
  if (role === 'Busser') return { start: '11:00', end: '19:00' };
  if (role === 'Food Runner') return { start: '12:00', end: '20:00' };
  return { start: '13:00', end: '21:00' }; // Expo fallback
}

export function seedDemoData(): void {
  const db = getDb();

  const needsReseed = shouldReseed(db);
  if (!needsReseed) {
    const existingCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
    if (existingCount > 0) return;
  }

  db.transaction(() => {
    if (needsReseed) clearSeedData(db);

    const insertSite = db.prepare(
      `INSERT INTO sites (
        name, city, state, timezone, site_type, jurisdiction,
        address, business_hours, employee_capacity, foh_roles, boh_roles
      ) VALUES (?, ?, ?, ?, 'restaurant', 'default', ?, ?, ?, ?, ?)`
    );

    const siteIds: number[] = [];
    for (const s of SITE_SEED) {
      const result = insertSite.run(
        s.name,
        s.city,
        s.state,
        s.timezone,
        s.address,
        s.businessHours,
        s.employeeCapacity,
        JSON.stringify(FOH_ROLES),
        JSON.stringify(BOH_ROLES),
      );
      siteIds.push(result.lastInsertRowid as number);
    }

    const firstNames = [
      'Alice', 'Blake', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack',
      'Karen', 'Liam', 'Mia', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Ruby', 'Sam', 'Tina',
      'Uma', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zane', 'Ava', 'Ben', 'Chloe', 'Derek',
      'Elena', 'Felix', 'Gina', 'Hugo', 'Isla', 'Jalen', 'Kira', 'Leo', 'Mason', 'Nina',
      'Owen', 'Paige', 'Rafael', 'Sofia', 'Theo', 'Val', 'Wyatt', 'Zoe',
    ];
    const lastNames = [
      'Johnson', 'Smith', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson',
      'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark',
    ];

    const insertEmployee = db.prepare(`
      INSERT INTO employees (
        name, first_name, last_name, role, role_title, department,
        pay_type, hourly_rate, weekly_hours_max, email, phone, hire_date, site_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAvailability = db.prepare(
      'INSERT INTO availability (employee_id, day_of_week, start_time, end_time, availability_type) VALUES (?, ?, ?, ?, ?)' 
    );

    const insertPosition = db.prepare(
      'INSERT OR IGNORE INTO site_positions (site_id, name, sort_order) VALUES (?, ?, ?)' 
    );

    let personCursor = 0;
    const allEmployees: Array<{ id: number; role: string; site_id: number; roleIndex: number }> = [];

    for (const siteId of siteIds) {
      const allRolesForSite = [...new Set([...FOH_ROLES, ...BOH_ROLES])];
      allRolesForSite.forEach((role, idx) => insertPosition.run(siteId, role, idx));

      for (const roleSeed of ROLE_PLAN) {
        for (let i = 0; i < roleSeed.count; i++) {
          const first = firstNames[personCursor % firstNames.length];
          const last = lastNames[(personCursor + i) % lastNames.length];
          personCursor++;

          let adjustedFirst = first;
          if (siteId === siteIds[0] && roleSeed.role === 'Manager' && i === 0) adjustedFirst = 'Alice';
          if (siteId === siteIds[0] && roleSeed.role === 'Server' && i === 0) adjustedFirst = 'Bob';
          const name = `${adjustedFirst} ${last}`;
          const hourlyRate = Number((roleSeed.minRate + ((i % 3) / 2) * (roleSeed.maxRate - roleSeed.minRate)).toFixed(2));
          const payType = roleSeed.role === 'Manager' ? 'salaried' : 'hourly';
          const email = `${adjustedFirst.toLowerCase()}.${last.toLowerCase()}@${siteId === siteIds[0] ? 'bellanapoli.com' : 'bluedoor.com'}`;
          const phone = `(555) ${String(1000 + personCursor).padStart(4, '0')}`;

          const empResult = insertEmployee.run(
            name,
            adjustedFirst,
            last,
            roleSeed.role,
            roleSeed.role,
            roleSeed.department,
            payType,
            payType === 'salaried' ? 0 : hourlyRate,
            roleSeed.weeklyMax,
            email,
            phone,
            addDays('2022-01-01', personCursor),
            siteId,
          );

          const employeeId = empResult.lastInsertRowid as number;
          allEmployees.push({ id: employeeId, role: roleSeed.role, site_id: siteId, roleIndex: i });

          for (let day = 0; day < 7; day++) {
            insertAvailability.run(employeeId, day, '08:00', '23:59', 'specific');
          }
        }
      }
    }

    const thisMonday = currentWeekMonday();
    const lastMonday = addDays(thisMonday, -7);

    const insertForecast = db.prepare(
      'INSERT INTO forecasts (date, site_id, expected_revenue, expected_covers) VALUES (?, ?, ?, ?)' 
    );

    for (const weekStart of [lastMonday, thisMonday]) {
      for (const siteId of siteIds) {
        for (let d = 0; d < 7; d++) {
          const date = addDays(weekStart, d);
          const weekend = d === 5 || d === 6;
          const baseRevenue = siteId === siteIds[0] ? 6200 : 5600;
          const expectedRevenue = baseRevenue + (d * 250) + (weekend ? 900 : 0);
          const expectedCovers = Math.round(expectedRevenue / 31);
          insertForecast.run(date, siteId, expectedRevenue, expectedCovers);
        }
      }
    }

    const insertSchedule = db.prepare(
      "INSERT INTO schedules (week_start, labor_budget, status, site_id) VALUES (?, ?, 'published', ?)"
    );
    const insertShift = db.prepare(
      "INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
    );

    for (const weekStart of [lastMonday, thisMonday]) {
      for (const siteId of siteIds) {
        const scheduleId = insertSchedule.run(weekStart, 14000, siteId).lastInsertRowid as number;
        const siteEmployees = allEmployees.filter(e => e.site_id === siteId);

        for (let d = 0; d < 7; d++) {
          const date = addDays(weekStart, d);
          for (const emp of siteEmployees) {
            const takesDayOff = (emp.id + d + (weekStart === thisMonday ? 1 : 0)) % 6 === 0;
            if (takesDayOff) continue;
            const times = shiftWindowForRole(emp.role, emp.roleIndex);
            insertShift.run(scheduleId, emp.id, date, times.start, times.end, emp.role);
          }
        }
      }
    }

    const insertUser = db.prepare(
      'INSERT OR IGNORE INTO users (username, password_hash, employee_id, is_manager) VALUES (?, ?, ?, ?)' 
    );
    const allSeeded = db.prepare('SELECT id, role, first_name FROM employees ORDER BY id').all() as any[];
    const usedUsernames = new Set<string>();

    for (const emp of allSeeded) {
      const base = String(emp.first_name || 'user').toLowerCase();
      let username = base;
      let suffix = 2;
      while (usedUsernames.has(username)) {
        username = `${base}${suffix}`;
        suffix += 1;
      }
      usedUsernames.add(username);
      const hash = bcrypt.hashSync('password123', 4);
      const isManager = emp.role === 'Manager' ? 1 : 0;
      insertUser.run(username, hash, emp.id, isManager);
    }

    validateSeedData();
  })();
}

export function validateSeedData(): void {
  const db = getDb();

  const siteCount = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as any).c;
  if (siteCount < 2) throw new Error(`Seed validation: expected ≥ 2 sites, found ${siteCount}`);

  const nonRestaurantCount = (db.prepare("SELECT COUNT(*) as c FROM sites WHERE site_type != 'restaurant'").get() as any).c;
  if (nonRestaurantCount > 0) throw new Error(`Seed validation: expected only restaurant sites, found ${nonRestaurantCount} non-restaurant site(s)`);

  const empCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  if (empCount < MIN_EXPECTED_EMPLOYEES || empCount > MAX_EMPLOYEES) {
    throw new Error(`Seed validation: expected ${MIN_EXPECTED_EMPLOYEES}-${MAX_EMPLOYEES} employees, found ${empCount}`);
  }

  const schedulesWithNoShifts = db.prepare(`
    SELECT sc.id FROM schedules sc
    LEFT JOIN shifts sh ON sh.schedule_id = sc.id
    GROUP BY sc.id HAVING COUNT(sh.id) = 0
  `).all() as any[];
  if (schedulesWithNoShifts.length > 0) {
    throw new Error(`Seed validation: ${schedulesWithNoShifts.length} schedule(s) have no shifts`);
  }

  const managersWithNoShifts = db.prepare(`
    SELECT e.id, e.name FROM employees e
    JOIN users u ON u.employee_id = e.id
    WHERE e.role = 'Manager' AND u.is_manager = 1
      AND NOT EXISTS (SELECT 1 FROM shifts sh WHERE sh.employee_id = e.id)
  `).all() as any[];
  if (managersWithNoShifts.length > 0) {
    throw new Error(`Seed validation: managers with no shifts: ${managersWithNoShifts.map((m: any) => m.name).join(', ')}`);
  }

  console.log(
    `✓ Seed validation passed — ${siteCount} sites, ${empCount} employees, all schedules have shifts, all managers have shifts`
  );
}
