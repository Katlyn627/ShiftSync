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

const MAX_EMPLOYEES = 90;
const MIN_EXPECTED_EMPLOYEES = 68;
const EXPECTED_SITES = [
  { name: 'Bella Napoli', siteType: 'restaurant' },
  { name: 'The Blue Door', siteType: 'restaurant' },
  { name: 'Global Impact Initiative', siteType: 'nonprofit' },
];

function shouldReseed(db: Database.Database): boolean {
  const siteRows = db.prepare('SELECT name, site_type FROM sites').all() as { name: string; site_type: string }[];
  if (siteRows.length < EXPECTED_SITES.length) return true;
  if (EXPECTED_SITES.some((site) => !siteRows.some((row) => row.name === site.name && row.site_type === site.siteType))) return true;

  const empCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  if (empCount < MIN_EXPECTED_EMPLOYEES || empCount > MAX_EMPLOYEES) return true;

  const empsWithSite = (db.prepare('SELECT COUNT(*) as c FROM employees WHERE site_id IS NOT NULL').get() as any).c;
  if (empsWithSite !== empCount) return true;

  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  if (userCount < empCount) return true;

  const forecastsWithSite = (db.prepare('SELECT COUNT(*) as c FROM forecasts WHERE site_id IS NOT NULL').get() as any).c;
  if (forecastsWithSite < 14) return true;

  const schedulesWithSite = (db.prepare('SELECT COUNT(*) as c FROM schedules WHERE site_id IS NOT NULL').get() as any).c;
  if (schedulesWithSite < EXPECTED_SITES.length) return true;

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
  siteType: string;
  jurisdiction: string;
  emailDomain: string;
  address: string;
  businessHours: string;
  employeeCapacity: number;
  baseRevenue: number;
  averageCheckSize: number;
  fohRoles: string[];
  bohRoles: string[];
  rolePlan: RoleSeed[];
}

interface RoleSeed {
  role: string;
  roleTitle?: string;
  department: string;
  count: number;
  minRate: number;
  maxRate: number;
  weeklyMax: number;
  isManager?: boolean;
  forcedUsernames?: string[];
  preferredNames?: Array<{ first: string; last: string }>;
}

const RESTAURANT_FOH_ROLES = ['Busser', 'Host', 'Server', 'Food Runner', 'Expo'];
const RESTAURANT_BOH_ROLES = ['Line Cook', 'Head Chef', 'Sous Chef', 'Dishwasher', 'Manager'];

const RESTAURANT_ROLE_PLAN: RoleSeed[] = [
  { role: 'Manager', department: 'Management', count: 2, minRate: 22, maxRate: 26, weeklyMax: 45, isManager: true },
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

const HUMANITARIAN_FOH_ROLES = [
  'Program Officer',
  'Field Coordinator',
  'Volunteer Coordinator',
  'Child Development Specialist',
  'Community Health Case Worker',
];
const HUMANITARIAN_BOH_ROLES = [
  'International Program Manager',
  'Chief Executive Officer',
  'Finance and HR Coordinator',
  'Monitoring and Evaluation Officer',
  'Safeguarding Officer',
  'Logistics and Grants Coordinator',
];

const HUMANITARIAN_ROLE_PLAN: RoleSeed[] = [
  {
    role: 'Manager',
    roleTitle: 'Chief Executive Officer',
    department: 'Executive Leadership',
    count: 1,
    minRate: 38,
    maxRate: 43,
    weeklyMax: 45,
    isManager: true,
    forcedUsernames: ['gii_ceo'],
    preferredNames: [{ first: 'Marcus', last: 'Vance' }],
  },
  {
    role: 'Manager',
    roleTitle: 'International Program Manager',
    department: 'Humanitarian Aid & Emergency Relief',
    count: 1,
    minRate: 34,
    maxRate: 38,
    weeklyMax: 45,
    isManager: true,
    forcedUsernames: ['gii_ipm'],
    preferredNames: [{ first: 'Tariq', last: 'Al-Mansoor' }],
  },
  {
    role: 'Manager',
    roleTitle: 'Program Officer - Girls Education and Empowerment',
    department: 'Child Development & Youth Services',
    count: 1,
    minRate: 30,
    maxRate: 34,
    weeklyMax: 44,
    isManager: true,
    forcedUsernames: ['gii_programofficer'],
    preferredNames: [{ first: 'Nia', last: 'Kimani' }],
  },
  { role: 'Program Officer', department: 'Child Development & Youth Services', count: 5, minRate: 24, maxRate: 29, weeklyMax: 42 },
  {
    role: 'Field Coordinator',
    department: 'Humanitarian Aid & Emergency Relief',
    count: 4,
    minRate: 22,
    maxRate: 26,
    weeklyMax: 42,
    forcedUsernames: ['gii_fieldlead'],
    preferredNames: [{ first: 'Kofi', last: 'Achebe' }],
  },
  { role: 'Volunteer Coordinator', department: 'Volunteer & Community Engagement', count: 4, minRate: 20, maxRate: 24, weeklyMax: 40 },
  { role: 'Child Development Specialist', department: 'Child Development & Youth Services', count: 5, minRate: 23, maxRate: 28, weeklyMax: 42 },
  { role: 'Monitoring and Evaluation Officer', department: 'Development & Grant Management', count: 3, minRate: 25, maxRate: 31, weeklyMax: 42 },
  { role: 'Safeguarding Officer', department: 'Community Health & Psycho-Social Support', count: 3, minRate: 24, maxRate: 29, weeklyMax: 40 },
  { role: 'Logistics and Grants Coordinator', department: 'Development & Grant Management', count: 3, minRate: 21, maxRate: 25, weeklyMax: 40 },
  { role: 'Finance and HR Coordinator', department: 'Finance, HR & Administrative Ops', count: 2, minRate: 24, maxRate: 29, weeklyMax: 40 },
  { role: 'Community Health Case Worker', department: 'Community Health & Psycho-Social Support', count: 3, minRate: 23, maxRate: 27, weeklyMax: 40 },
];

const SITE_SEED: SiteSeed[] = [
  {
    name: 'Global Impact Initiative',
    city: 'Washington',
    state: 'DC',
    timezone: 'America/New_York',
    siteType: 'nonprofit',
    jurisdiction: 'intl-program',
    emailDomain: 'globalimpactinitiative.org',
    address: '1800 I St NW, Washington, DC',
    businessHours: 'Mon-Fri 08:00-19:00',
    employeeCapacity: 34,
    baseRevenue: 4100,
    averageCheckSize: 52,
    fohRoles: HUMANITARIAN_FOH_ROLES,
    bohRoles: HUMANITARIAN_BOH_ROLES,
    rolePlan: HUMANITARIAN_ROLE_PLAN,
  },
  {
    name: 'Bella Napoli',
    city: 'Chicago',
    state: 'IL',
    timezone: 'America/Chicago',
    siteType: 'restaurant',
    jurisdiction: 'us-il',
    emailDomain: 'bellanapoli.com',
    address: '120 W Randolph St, Chicago, IL',
    businessHours: 'Mon-Sun 11:00-23:00',
    employeeCapacity: 24,
    baseRevenue: 6200,
    averageCheckSize: 31,
    fohRoles: RESTAURANT_FOH_ROLES,
    bohRoles: RESTAURANT_BOH_ROLES,
    rolePlan: RESTAURANT_ROLE_PLAN,
  },
  {
    name: 'The Blue Door',
    city: 'Austin',
    state: 'TX',
    timezone: 'America/Chicago',
    siteType: 'restaurant',
    jurisdiction: 'us-tx',
    emailDomain: 'bluedoor.com',
    address: '410 Congress Ave, Austin, TX',
    businessHours: 'Mon-Sun 10:00-22:00',
    employeeCapacity: 24,
    baseRevenue: 5600,
    averageCheckSize: 30,
    fohRoles: RESTAURANT_FOH_ROLES,
    bohRoles: RESTAURANT_BOH_ROLES,
    rolePlan: RESTAURANT_ROLE_PLAN,
  },
];

function shiftWindowForRole(role: string, indexInRole: number): { start: string; end: string } {
  if (role === 'Manager') return { start: '09:00', end: '17:00' };
  if (role === 'Program Officer') return indexInRole % 2 === 0 ? { start: '08:30', end: '16:30' } : { start: '10:00', end: '18:00' };
  if (role === 'Field Coordinator') return indexInRole % 2 === 0 ? { start: '07:30', end: '15:30' } : { start: '09:00', end: '17:00' };
  if (role === 'Volunteer Coordinator') return { start: '09:00', end: '17:00' };
  if (role === 'Child Development Specialist') return indexInRole % 2 === 0 ? { start: '08:00', end: '16:00' } : { start: '11:00', end: '19:00' };
  if (role === 'Monitoring and Evaluation Officer') return { start: '09:00', end: '17:00' };
  if (role === 'Safeguarding Officer') return { start: '10:00', end: '18:00' };
  if (role === 'Logistics and Grants Coordinator') return { start: '09:30', end: '17:30' };
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

function seededPhotoUrl(firstName: string, lastName: string, role: string): string {
  const seed = encodeURIComponent(`${firstName}-${lastName}-${role}`.toLowerCase());
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundType=gradientLinear`;
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const seededSites: Array<SiteSeed & { id: number }> = [];
    for (const s of SITE_SEED) {
      const result = insertSite.run(
        s.name,
        s.city,
        s.state,
        s.timezone,
        s.siteType,
        s.jurisdiction,
        s.address,
        s.businessHours,
        s.employeeCapacity,
        JSON.stringify(s.fohRoles),
        JSON.stringify(s.bohRoles),
      );
      seededSites.push({ ...s, id: result.lastInsertRowid as number });
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
        pay_type, hourly_rate, weekly_hours_max, email, phone, photo_url, hire_date, site_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAvailability = db.prepare(
      'INSERT INTO availability (employee_id, day_of_week, start_time, end_time, availability_type) VALUES (?, ?, ?, ?, ?)' 
    );

    const insertPosition = db.prepare(
      'INSERT OR IGNORE INTO site_positions (site_id, name, sort_order) VALUES (?, ?, ?)' 
    );

    let personCursor = 0;
    const allEmployees: Array<{ id: number; role: string; site_id: number; roleIndex: number; roleTitle: string; isManager: boolean; forcedUsername?: string }> = [];

    for (const site of seededSites) {
      const allRolesForSite = [...new Set([...site.fohRoles, ...site.bohRoles])];
      allRolesForSite.forEach((role, idx) => insertPosition.run(site.id, role, idx));

      for (const roleSeed of site.rolePlan) {
        for (let i = 0; i < roleSeed.count; i++) {
          const first = firstNames[personCursor % firstNames.length];
          const last = lastNames[(personCursor + i) % lastNames.length];
          personCursor++;

          let adjustedFirst = first;
          let adjustedLast = last;
          if (site.name === 'Bella Napoli' && roleSeed.role === 'Manager' && i === 0) adjustedFirst = 'Alice';
          if (site.name === 'Bella Napoli' && roleSeed.role === 'Server' && i === 0) adjustedFirst = 'Bob';
          if (roleSeed.preferredNames?.[i]) {
            adjustedFirst = roleSeed.preferredNames[i].first;
            adjustedLast = roleSeed.preferredNames[i].last;
          }
          const name = `${adjustedFirst} ${adjustedLast}`;
          const hourlyRate = Number((roleSeed.minRate + ((i % 3) / 2) * (roleSeed.maxRate - roleSeed.minRate)).toFixed(2));
          const payType = roleSeed.isManager || roleSeed.role === 'Manager' ? 'salaried' : 'hourly';
          const email = `${adjustedFirst.toLowerCase()}.${adjustedLast.toLowerCase()}@${site.emailDomain}`;
          const phone = `(555) ${String(1000 + personCursor).padStart(4, '0')}`;
          const roleTitle = roleSeed.roleTitle || roleSeed.role;
          const photoUrl = seededPhotoUrl(adjustedFirst, adjustedLast, roleTitle);

          const empResult = insertEmployee.run(
            name,
            adjustedFirst,
            adjustedLast,
            roleSeed.role,
            roleTitle,
            roleSeed.department,
            payType,
            hourlyRate,
            roleSeed.weeklyMax,
            email,
            phone,
            photoUrl,
            addDays('2022-01-01', personCursor),
            site.id,
          );

          const employeeId = empResult.lastInsertRowid as number;
          allEmployees.push({
            id: employeeId,
            role: roleSeed.role,
            site_id: site.id,
            roleIndex: i,
            roleTitle,
            isManager: !!roleSeed.isManager || roleSeed.role === 'Manager',
            forcedUsername: roleSeed.forcedUsernames?.[i],
          });

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
    const DAY_REVENUE_MULTIPLIERS = [0.86, 0.82, 0.9, 0.98, 1.12, 1.2, 1.04]; // Monday..Sunday

    for (const weekStart of [lastMonday, thisMonday]) {
      for (const site of seededSites) {
        for (let d = 0; d < 7; d++) {
          const date = addDays(weekStart, d);
          const baseRevenue = site.baseRevenue;
          const weeklyTrend = weekStart === thisMonday ? 1.03 : 0.97;
          const dayVariance = (((site.id * 37 + d * 19 + (weekStart === thisMonday ? 11 : 3)) % 7) - 3) * 85;
          const expectedRevenue = Math.max(1800, Math.round(baseRevenue * DAY_REVENUE_MULTIPLIERS[d] * weeklyTrend + dayVariance));
          const expectedCovers = Math.max(40, Math.round(expectedRevenue / site.averageCheckSize));
          insertForecast.run(date, site.id, expectedRevenue, expectedCovers);
        }
      }
    }

    const insertSchedule = db.prepare(
      "INSERT INTO schedules (week_start, labor_budget, status, site_id) VALUES (?, ?, 'published', ?)"
    );
    const insertShift = db.prepare(
      "INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
    );

    const roleWorkloadFactor: Record<string, number> = {
      Manager: 0.95,
      'Head Chef': 0.9,
      'Sous Chef': 0.88,
      'Line Cook': 0.76,
      Dishwasher: 0.72,
      Server: 0.68,
      Host: 0.62,
      Busser: 0.62,
      'Food Runner': 0.66,
      Expo: 0.65,
      'Program Officer': 0.72,
      'Field Coordinator': 0.7,
      'Volunteer Coordinator': 0.62,
      'Child Development Specialist': 0.7,
      'Monitoring and Evaluation Officer': 0.64,
      'Safeguarding Officer': 0.66,
      'Logistics and Grants Coordinator': 0.63,
    };
    const dayWorkProbability = [0.62, 0.58, 0.64, 0.74, 0.84, 0.88, 0.72]; // Monday..Sunday

    for (const weekStart of [lastMonday, thisMonday]) {
      for (const site of seededSites) {
        const scheduleId = insertSchedule.run(weekStart, 14000, site.id).lastInsertRowid as number;
        const siteEmployees = allEmployees.filter(e => e.site_id === site.id);

        for (let d = 0; d < 7; d++) {
          const date = addDays(weekStart, d);
          let managersScheduled = 0;
          for (const emp of siteEmployees) {
            const workFactor = roleWorkloadFactor[emp.role] ?? 0.66;
            const threshold = Math.min(96, Math.round(dayWorkProbability[d] * workFactor * 100));
            const deterministic = (emp.id * 31 + site.id * 17 + d * 13 + (weekStart === thisMonday ? 7 : 3) + emp.roleIndex * 5) % 100;
            if (deterministic >= threshold) continue;
            const times = shiftWindowForRole(emp.role, emp.roleIndex);
            insertShift.run(scheduleId, emp.id, date, times.start, times.end, emp.role);
            if (emp.role === 'Manager') managersScheduled += 1;
          }

          if (managersScheduled === 0) {
            const fallbackManager = siteEmployees.find((employee) => employee.role === 'Manager');
            if (fallbackManager) {
              const fallbackTimes = shiftWindowForRole(fallbackManager.role, fallbackManager.roleIndex);
              insertShift.run(scheduleId, fallbackManager.id, date, fallbackTimes.start, fallbackTimes.end, fallbackManager.role);
            }
          }
        }
      }
    }

    const insertUser = db.prepare(
      'INSERT OR IGNORE INTO users (username, password_hash, employee_id, is_manager) VALUES (?, ?, ?, ?)' 
    );
    const updateUserForEmployee = db.prepare(
      'UPDATE users SET username = ?, password_hash = ?, is_manager = ? WHERE employee_id = ?'
    );
    const userByEmployee = db.prepare('SELECT id FROM users WHERE employee_id = ?');
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

    for (const employee of allEmployees) {
      if (!employee.forcedUsername) continue;
      let preferredUsername = employee.forcedUsername;
      let suffix = 2;
      while (usedUsernames.has(preferredUsername)) {
        preferredUsername = `${employee.forcedUsername}${suffix}`;
        suffix += 1;
      }
      usedUsernames.add(preferredUsername);
      const hash = bcrypt.hashSync('password123', 4);
      const isManager = employee.isManager ? 1 : 0;
      const existing = userByEmployee.get(employee.id) as { id: number } | undefined;
      if (existing) {
        updateUserForEmployee.run(preferredUsername, hash, isManager, employee.id);
      } else {
        insertUser.run(preferredUsername, hash, employee.id, isManager);
      }
    }

    validateSeedData();
  })();
}

export function validateSeedData(): void {
  const db = getDb();

  const siteCount = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as any).c;
  if (siteCount < EXPECTED_SITES.length) throw new Error(`Seed validation: expected ≥ ${EXPECTED_SITES.length} sites, found ${siteCount}`);

  for (const expectedSite of EXPECTED_SITES) {
    const found = db.prepare('SELECT COUNT(*) as c FROM sites WHERE name = ? AND site_type = ?').get(expectedSite.name, expectedSite.siteType) as any;
    if ((found?.c || 0) === 0) {
      throw new Error(`Seed validation: missing expected site ${expectedSite.name} (${expectedSite.siteType})`);
    }
  }

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
