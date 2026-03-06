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
    // ════════════════════════════════════════════════════════════════════════
    // BELLA NAPOLI — Italian restaurant, Chicago IL (~27 employees)
    // ════════════════════════════════════════════════════════════════════════
    // Management (2)
    { first_name: 'Alice',   last_name: 'Johnson',  role: 'Manager',  role_title: 'General Manager',       department: 'Management',      hourly_rate: 24.0, weekly_hours_max: 45, email: 'alice.johnson@bellanapoli.com',   phone: '(312) 555-0101', hire_date: '2019-03-15', site_id: siteR1, avatar_key: 'alice_bn' },
    { first_name: 'Marco',   last_name: 'Romano',   role: 'Manager',  role_title: 'Assistant Manager',     department: 'Management',      hourly_rate: 22.0, weekly_hours_max: 42, email: 'marco.romano@bellanapoli.com',    phone: '(312) 555-0109', hire_date: '2020-01-10', site_id: siteR1, avatar_key: 'marco_bn' },
    // Kitchen (9)
    { first_name: 'David',   last_name: 'Brown',    role: 'Kitchen',  role_title: 'Executive Chef',        department: 'Kitchen',         hourly_rate: 24.0, weekly_hours_max: 45, email: 'david.brown@bellanapoli.com',     phone: '(312) 555-0104', hire_date: '2020-01-20', site_id: siteR1, avatar_key: 'david_bn' },
    { first_name: 'Eve',     last_name: 'Davis',    role: 'Kitchen',  role_title: 'Sous Chef',             department: 'Kitchen',         hourly_rate: 19.0, weekly_hours_max: 42, email: 'eve.davis@bellanapoli.com',       phone: '(312) 555-0105', hire_date: '2021-04-05', site_id: siteR1, avatar_key: 'eve_bn' },
    { first_name: 'Jake',    last_name: 'Parker',   role: 'Kitchen',  role_title: 'Head Line Cook',        department: 'Kitchen',         hourly_rate: 18.0, weekly_hours_max: 40, email: 'jake.parker@bellanapoli.com',     phone: '(312) 555-0110', hire_date: '2021-08-15', site_id: siteR1, avatar_key: 'jake_bn' },
    { first_name: 'Sofia',   last_name: 'Reyes',    role: 'Kitchen',  role_title: 'Line Cook',             department: 'Kitchen',         hourly_rate: 16.5, weekly_hours_max: 40, email: 'sofia.reyes@bellanapoli.com',     phone: '(312) 555-0111', hire_date: '2022-03-10', site_id: siteR1, avatar_key: 'sofia_bn' },
    { first_name: 'Tyler',   last_name: 'Brooks',   role: 'Kitchen',  role_title: 'Line Cook',             department: 'Kitchen',         hourly_rate: 16.0, weekly_hours_max: 40, email: 'tyler.brooks@bellanapoli.com',    phone: '(312) 555-0112', hire_date: '2022-06-20', site_id: siteR1, avatar_key: 'tyler_bn' },
    { first_name: 'Natalie', last_name: 'Green',    role: 'Kitchen',  role_title: 'Prep Cook',             department: 'Kitchen',         hourly_rate: 15.0, weekly_hours_max: 38, email: 'natalie.green@bellanapoli.com',   phone: '(312) 555-0113', hire_date: '2022-09-01', site_id: siteR1, avatar_key: 'natalie_bn' },
    { first_name: 'Marcus',  last_name: 'White',    role: 'Kitchen',  role_title: 'Prep Cook',             department: 'Kitchen',         hourly_rate: 15.0, weekly_hours_max: 38, email: 'marcus.white@bellanapoli.com',    phone: '(312) 555-0114', hire_date: '2023-02-14', site_id: siteR1, avatar_key: 'marcus_bn' },
    { first_name: 'Owen',    last_name: 'Hall',     role: 'Kitchen',  role_title: 'Dishwasher',            department: 'Kitchen',         hourly_rate: 13.0, weekly_hours_max: 35, email: 'owen.hall@bellanapoli.com',       phone: '(312) 555-0115', hire_date: '2023-05-22', site_id: siteR1, avatar_key: 'owen_bn' },
    { first_name: 'Ruby',    last_name: 'Adams',    role: 'Kitchen',  role_title: 'Dishwasher',            department: 'Kitchen',         hourly_rate: 13.0, weekly_hours_max: 32, email: 'ruby.adams@bellanapoli.com',      phone: '(312) 555-0116', hire_date: '2023-08-15', site_id: siteR1, avatar_key: 'ruby_bn' },
    // Servers (8)
    { first_name: 'Bob',     last_name: 'Smith',    role: 'Server',   role_title: 'Lead Server',           department: 'Front of House',  hourly_rate: 14.0, weekly_hours_max: 40, email: 'bob.smith@bellanapoli.com',       phone: '(312) 555-0102', hire_date: '2020-06-01', site_id: siteR1, avatar_key: 'bob_bn' },
    { first_name: 'Carol',   last_name: 'White',    role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.5, weekly_hours_max: 35, email: 'carol.white@bellanapoli.com',     phone: '(312) 555-0103', hire_date: '2021-09-12', site_id: siteR1, avatar_key: 'carol_bn' },
    { first_name: 'Henry',   last_name: 'Moore',    role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.5, weekly_hours_max: 38, email: 'henry.moore@bellanapoli.com',     phone: '(312) 555-0108', hire_date: '2022-07-19', site_id: siteR1, avatar_key: 'henry_bn' },
    { first_name: 'Diana',   last_name: 'Prince',   role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.5, weekly_hours_max: 35, email: 'diana.prince@bellanapoli.com',    phone: '(312) 555-0117', hire_date: '2022-01-05', site_id: siteR1, avatar_key: 'diana_bn' },
    { first_name: 'Ethan',   last_name: 'Ross',     role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.0, weekly_hours_max: 38, email: 'ethan.ross@bellanapoli.com',      phone: '(312) 555-0118', hire_date: '2022-11-20', site_id: siteR1, avatar_key: 'ethan_bn' },
    { first_name: 'Fiona',   last_name: 'Bell',     role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.0, weekly_hours_max: 32, email: 'fiona.bell@bellanapoli.com',      phone: '(312) 555-0119', hire_date: '2023-03-08', site_id: siteR1, avatar_key: 'fiona_bn' },
    { first_name: 'George',  last_name: 'Hill',     role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.0, weekly_hours_max: 30, email: 'george.hill@bellanapoli.com',     phone: '(312) 555-0120', hire_date: '2023-06-15', site_id: siteR1, avatar_key: 'george_bn' },
    { first_name: 'Amanda',  last_name: 'Fox',      role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.0, weekly_hours_max: 30, email: 'amanda.fox@bellanapoli.com',      phone: '(312) 555-0121', hire_date: '2023-10-02', site_id: siteR1, avatar_key: 'amanda_bn' },
    // Bar (3)
    { first_name: 'Frank',   last_name: 'Miller',   role: 'Bar',      role_title: 'Head Bartender',        department: 'Bar',             hourly_rate: 17.5, weekly_hours_max: 40, email: 'frank.miller@bellanapoli.com',    phone: '(312) 555-0106', hire_date: '2020-11-08', site_id: siteR1, avatar_key: 'frank_bn' },
    { first_name: 'Lily',    last_name: 'Turner',   role: 'Bar',      role_title: 'Bartender',             department: 'Bar',             hourly_rate: 15.5, weekly_hours_max: 38, email: 'lily.turner@bellanapoli.com',     phone: '(312) 555-0122', hire_date: '2022-04-20', site_id: siteR1, avatar_key: 'lily_bn' },
    { first_name: 'Oliver',  last_name: 'Park',     role: 'Bar',      role_title: 'Barback',               department: 'Bar',             hourly_rate: 13.0, weekly_hours_max: 30, email: 'oliver.park@bellanapoli.com',     phone: '(312) 555-0123', hire_date: '2023-09-10', site_id: siteR1, avatar_key: 'oliver_bn' },
    // Hosts (3)
    { first_name: 'Grace',   last_name: 'Wilson',   role: 'Host',     role_title: 'Lead Host',             department: 'Front of House',  hourly_rate: 13.0, weekly_hours_max: 30, email: 'grace.wilson@bellanapoli.com',    phone: '(312) 555-0107', hire_date: '2022-02-14', site_id: siteR1, avatar_key: 'grace_bn' },
    { first_name: 'Hazel',   last_name: 'Price',    role: 'Host',     role_title: 'Host',                  department: 'Front of House',  hourly_rate: 12.5, weekly_hours_max: 28, email: 'hazel.price@bellanapoli.com',     phone: '(312) 555-0124', hire_date: '2023-04-05', site_id: siteR1, avatar_key: 'hazel_bn' },
    { first_name: 'Isaac',   last_name: 'Reed',     role: 'Host',     role_title: 'Busser',                department: 'Front of House',  hourly_rate: 12.5, weekly_hours_max: 25, email: 'isaac.reed@bellanapoli.com',      phone: '(312) 555-0125', hire_date: '2024-02-20', site_id: siteR1, avatar_key: 'isaac_bn' },

    // ════════════════════════════════════════════════════════════════════════
    // THE BLUE DOOR — Restaurant, Austin TX (~26 employees)
    // ════════════════════════════════════════════════════════════════════════
    // Management (2)
    { first_name: 'Iris',       last_name: 'Taylor',   role: 'Manager',  role_title: 'Restaurant Manager',    department: 'Management',      hourly_rate: 23.0, weekly_hours_max: 45, email: 'iris.taylor@bluedoor.com',       phone: '(512) 555-0201', hire_date: '2018-08-01', site_id: siteR2, avatar_key: 'iris_bd' },
    { first_name: 'Victor',     last_name: 'Cruz',     role: 'Manager',  role_title: 'Kitchen Manager',       department: 'Management',      hourly_rate: 21.0, weekly_hours_max: 42, email: 'victor.cruz@bluedoor.com',       phone: '(512) 555-0209', hire_date: '2019-05-15', site_id: siteR2, avatar_key: 'victor_bd' },
    // Kitchen (9)
    { first_name: 'Liam',       last_name: 'Jackson',  role: 'Kitchen',  role_title: 'Sous Chef',             department: 'Kitchen',         hourly_rate: 19.0, weekly_hours_max: 42, email: 'liam.jackson@bluedoor.com',      phone: '(512) 555-0204', hire_date: '2021-10-04', site_id: siteR2, avatar_key: 'liam_bd' },
    { first_name: 'Mia',        last_name: 'Robinson', role: 'Kitchen',  role_title: 'Line Cook',             department: 'Kitchen',         hourly_rate: 17.0, weekly_hours_max: 40, email: 'mia.robinson@bluedoor.com',      phone: '(512) 555-0205', hire_date: '2022-01-17', site_id: siteR2, avatar_key: 'mia_bd' },
    { first_name: 'Carlos',     last_name: 'Rivera',   role: 'Kitchen',  role_title: 'Line Cook',             department: 'Kitchen',         hourly_rate: 16.5, weekly_hours_max: 40, email: 'carlos.rivera@bluedoor.com',     phone: '(512) 555-0210', hire_date: '2022-05-10', site_id: siteR2, avatar_key: 'carlos_bd' },
    { first_name: 'Amber',      last_name: 'Chen',     role: 'Kitchen',  role_title: 'Line Cook',             department: 'Kitchen',         hourly_rate: 16.0, weekly_hours_max: 40, email: 'amber.chen@bluedoor.com',        phone: '(512) 555-0211', hire_date: '2022-09-20', site_id: siteR2, avatar_key: 'amber_bd' },
    { first_name: 'Dylan',      last_name: 'Murphy',   role: 'Kitchen',  role_title: 'Prep Cook',             department: 'Kitchen',         hourly_rate: 14.5, weekly_hours_max: 38, email: 'dylan.murphy@bluedoor.com',      phone: '(512) 555-0212', hire_date: '2023-01-08', site_id: siteR2, avatar_key: 'dylan_bd' },
    { first_name: 'Sara',       last_name: 'Wilson',   role: 'Kitchen',  role_title: 'Prep Cook',             department: 'Kitchen',         hourly_rate: 14.5, weekly_hours_max: 38, email: 'sara.wilson@bluedoor.com',       phone: '(512) 555-0213', hire_date: '2023-03-22', site_id: siteR2, avatar_key: 'sara_bd' },
    { first_name: 'Jake',       last_name: 'Torres',   role: 'Kitchen',  role_title: 'Dishwasher',            department: 'Kitchen',         hourly_rate: 13.0, weekly_hours_max: 35, email: 'jake.torres@bluedoor.com',       phone: '(512) 555-0214', hire_date: '2023-06-15', site_id: siteR2, avatar_key: 'jake_bd' },
    { first_name: 'Emma',       last_name: 'Walsh',    role: 'Kitchen',  role_title: 'Dishwasher',            department: 'Kitchen',         hourly_rate: 13.0, weekly_hours_max: 30, email: 'emma.walsh@bluedoor.com',        phone: '(512) 555-0215', hire_date: '2023-10-05', site_id: siteR2, avatar_key: 'emma_bd' },
    { first_name: 'Nathan',     last_name: 'Bell',     role: 'Kitchen',  role_title: 'Pastry Cook',           department: 'Kitchen',         hourly_rate: 17.0, weekly_hours_max: 38, email: 'nathan.bell@bluedoor.com',       phone: '(512) 555-0216', hire_date: '2021-11-30', site_id: siteR2, avatar_key: 'nathan_bd' },
    // Servers (7)
    { first_name: 'Jack',       last_name: 'Anderson', role: 'Server',   role_title: 'Lead Server',           department: 'Front of House',  hourly_rate: 13.5, weekly_hours_max: 40, email: 'jack.anderson@bluedoor.com',     phone: '(512) 555-0202', hire_date: '2021-05-10', site_id: siteR2, avatar_key: 'jack_bd' },
    { first_name: 'Karen',      last_name: 'Thomas',   role: 'Server',   role_title: 'Senior Server',         department: 'Front of House',  hourly_rate: 14.5, weekly_hours_max: 40, email: 'karen.thomas@bluedoor.com',      phone: '(512) 555-0203', hire_date: '2020-03-22', site_id: siteR2, avatar_key: 'karen_bd' },
    { first_name: 'Peter',      last_name: 'Clark',    role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.0, weekly_hours_max: 35, email: 'peter.clark@bluedoor.com',       phone: '(512) 555-0208', hire_date: '2022-11-28', site_id: siteR2, avatar_key: 'peter_bd' },
    { first_name: 'Bella',      last_name: 'Scott',    role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 13.0, weekly_hours_max: 35, email: 'bella.scott@bluedoor.com',       phone: '(512) 555-0217', hire_date: '2022-07-14', site_id: siteR2, avatar_key: 'bella_bd' },
    { first_name: 'Christopher',last_name: 'Evans',    role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 12.5, weekly_hours_max: 32, email: 'christopher.evans@bluedoor.com', phone: '(512) 555-0218', hire_date: '2023-02-28', site_id: siteR2, avatar_key: 'christopher_bd' },
    { first_name: 'Maria',      last_name: 'Santos',   role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 12.5, weekly_hours_max: 32, email: 'maria.santos@bluedoor.com',      phone: '(512) 555-0219', hire_date: '2023-05-15', site_id: siteR2, avatar_key: 'maria_bd' },
    { first_name: 'Daniel',     last_name: 'Kim',      role: 'Server',   role_title: 'Server',                department: 'Front of House',  hourly_rate: 12.5, weekly_hours_max: 30, email: 'daniel.kim@bluedoor.com',        phone: '(512) 555-0220', hire_date: '2023-08-20', site_id: siteR2, avatar_key: 'daniel_bd' },
    // Hosts (3)
    { first_name: 'Olivia',     last_name: 'Martin',   role: 'Host',     role_title: 'Lead Host',             department: 'Front of House',  hourly_rate: 12.5, weekly_hours_max: 32, email: 'olivia.martin@bluedoor.com',     phone: '(512) 555-0207', hire_date: '2023-03-06', site_id: siteR2, avatar_key: 'olivia_bd' },
    { first_name: 'Ryan',       last_name: 'Lee',      role: 'Host',     role_title: 'Host',                  department: 'Front of House',  hourly_rate: 12.0, weekly_hours_max: 28, email: 'ryan.lee@bluedoor.com',          phone: '(512) 555-0221', hire_date: '2023-07-25', site_id: siteR2, avatar_key: 'ryan_bd' },
    { first_name: 'Sophie',     last_name: 'Green',    role: 'Host',     role_title: 'Busser',                department: 'Front of House',  hourly_rate: 12.0, weekly_hours_max: 25, email: 'sophie.green@bluedoor.com',      phone: '(512) 555-0222', hire_date: '2024-02-12', site_id: siteR2, avatar_key: 'sophie_bd' },
    // Bar (3)
    { first_name: 'Noah',       last_name: 'Harris',   role: 'Bar',      role_title: 'Head Bartender',        department: 'Bar',             hourly_rate: 16.0, weekly_hours_max: 38, email: 'noah.harris@bluedoor.com',       phone: '(512) 555-0206', hire_date: '2021-07-30', site_id: siteR2, avatar_key: 'noah_bd' },
    { first_name: 'Zoe',        last_name: 'Walker',   role: 'Bar',      role_title: 'Bartender',             department: 'Bar',             hourly_rate: 15.0, weekly_hours_max: 36, email: 'zoe.walker@bluedoor.com',        phone: '(512) 555-0223', hire_date: '2022-08-15', site_id: siteR2, avatar_key: 'zoe_bd' },
    { first_name: 'Alex',       last_name: 'Morgan',   role: 'Bar',      role_title: 'Barback',               department: 'Bar',             hourly_rate: 12.5, weekly_hours_max: 28, email: 'alex.morgan@bluedoor.com',       phone: '(512) 555-0224', hire_date: '2023-12-01', site_id: siteR2, avatar_key: 'alex_bd' },

    // ════════════════════════════════════════════════════════════════════════
    // GRAND PACIFIC HOTEL — 200-room hotel, New York NY (~95 employees)
    // ════════════════════════════════════════════════════════════════════════
    // Senior Management (6)
    { first_name: 'Quinn',      last_name: 'Lewis',      role: 'Manager',      role_title: 'General Manager',             department: 'Management',      hourly_rate: 38.0, weekly_hours_max: 50, email: 'quinn.lewis@grandpacific.com',       phone: '(212) 555-0301', hire_date: '2016-05-01', site_id: siteH1, avatar_key: 'quinn_gp' },
    { first_name: 'Patricia',   last_name: 'Williams',   role: 'Manager',      role_title: 'Assistant General Manager',   department: 'Management',      hourly_rate: 34.0, weekly_hours_max: 48, email: 'patricia.williams@grandpacific.com',  phone: '(212) 555-0309', hire_date: '2018-02-14', site_id: siteH1, avatar_key: 'patricia_gp' },
    { first_name: 'Benjamin',   last_name: 'Foster',     role: 'Manager',      role_title: 'Director of Revenue',         department: 'Management',      hourly_rate: 32.0, weekly_hours_max: 45, email: 'benjamin.foster@grandpacific.com',    phone: '(212) 555-0310', hire_date: '2019-06-10', site_id: siteH1, avatar_key: 'benjamin_gp' },
    { first_name: 'Stephanie',  last_name: 'Cole',       role: 'Manager',      role_title: 'Director of Human Resources', department: 'Management',      hourly_rate: 30.0, weekly_hours_max: 45, email: 'stephanie.cole@grandpacific.com',     phone: '(212) 555-0311', hire_date: '2020-01-20', site_id: siteH1, avatar_key: 'stephanie_gp' },
    { first_name: 'Michael',    last_name: 'Torres',     role: 'Manager',      role_title: 'Director of Sales & Marketing',department: 'Management',     hourly_rate: 31.0, weekly_hours_max: 45, email: 'michael.torres@grandpacific.com',     phone: '(212) 555-0312', hire_date: '2019-09-05', site_id: siteH1, avatar_key: 'michael_gp' },
    { first_name: 'Victor',     last_name: 'Lee',        role: 'Manager',      role_title: 'F&B Director',                department: 'Management',      hourly_rate: 32.0, weekly_hours_max: 48, email: 'victor.lee@grandpacific.com',         phone: '(212) 555-0306', hire_date: '2017-03-15', site_id: siteH1, avatar_key: 'victor_gp' },
    // Rooms Division Management (3)
    { first_name: 'Xavier',     last_name: 'Brown',      role: 'Manager',      role_title: 'Front Office Manager',        department: 'Management',      hourly_rate: 28.0, weekly_hours_max: 45, email: 'xavier.brown@grandpacific.com',       phone: '(212) 555-0308', hire_date: '2019-02-28', site_id: siteH1, avatar_key: 'xavier_gp' },
    { first_name: 'Hannah',     last_name: 'Park',       role: 'Manager',      role_title: 'Executive Housekeeper',       department: 'Management',      hourly_rate: 26.0, weekly_hours_max: 45, email: 'hannah.park@grandpacific.com',        phone: '(212) 555-0313', hire_date: '2018-11-01', site_id: siteH1, avatar_key: 'hannah_gp' },
    { first_name: 'Thomas',     last_name: 'Reed',       role: 'Manager',      role_title: 'Guest Services Manager',      department: 'Management',      hourly_rate: 27.0, weekly_hours_max: 45, email: 'thomas.reed@grandpacific.com',        phone: '(212) 555-0314', hire_date: '2020-04-15', site_id: siteH1, avatar_key: 'thomas_gp' },
    // F&B Management (3)
    { first_name: 'Anthony',    last_name: 'Rivera',     role: 'Manager',      role_title: 'Restaurant Manager',          department: 'Management',      hourly_rate: 26.0, weekly_hours_max: 45, email: 'anthony.rivera@grandpacific.com',     phone: '(212) 555-0315', hire_date: '2020-08-10', site_id: siteH1, avatar_key: 'anthony_gp' },
    { first_name: 'Christina',  last_name: 'Park',       role: 'Manager',      role_title: 'Executive Chef',              department: 'Management',      hourly_rate: 28.0, weekly_hours_max: 45, email: 'christina.park@grandpacific.com',     phone: '(212) 555-0316', hire_date: '2019-07-20', site_id: siteH1, avatar_key: 'christina_gp' },
    { first_name: 'Robert',     last_name: 'Miller',     role: 'Manager',      role_title: 'Banquet & Events Manager',    department: 'Management',      hourly_rate: 26.0, weekly_hours_max: 45, email: 'robert.miller@grandpacific.com',      phone: '(212) 555-0317', hire_date: '2021-02-01', site_id: siteH1, avatar_key: 'robert_gp' },
    // Engineering & Security Management (2)
    { first_name: 'Wendy',      last_name: 'Chen',       role: 'Manager',      role_title: 'Chief Engineer',              department: 'Management',      hourly_rate: 28.0, weekly_hours_max: 45, email: 'wendy.chen@grandpacific.com',         phone: '(212) 555-0307', hire_date: '2020-06-15', site_id: siteH1, avatar_key: 'wendy_gp' },
    { first_name: 'Jonathan',   last_name: 'Reed',       role: 'Manager',      role_title: 'Security Manager',            department: 'Management',      hourly_rate: 27.0, weekly_hours_max: 45, email: 'jonathan.reed@grandpacific.com',      phone: '(212) 555-0318', hire_date: '2018-09-15', site_id: siteH1, avatar_key: 'jonathan_gp' },
    // Front Office — Front Desk (9)
    { first_name: 'Rachel',     last_name: 'Scott',      role: 'Front Desk',   role_title: 'Front Desk Supervisor',       department: 'Front Office',    hourly_rate: 22.0, weekly_hours_max: 40, email: 'rachel.scott@grandpacific.com',       phone: '(212) 555-0302', hire_date: '2020-09-14', site_id: siteH1, avatar_key: 'rachel_gp' },
    { first_name: 'Sam',        last_name: 'Turner',     role: 'Front Desk',   role_title: 'Night Audit Supervisor',      department: 'Front Office',    hourly_rate: 23.0, weekly_hours_max: 40, email: 'sam.turner@grandpacific.com',         phone: '(212) 555-0303', hire_date: '2019-12-03', site_id: siteH1, avatar_key: 'sam_gp' },
    { first_name: 'Laura',      last_name: 'Kim',        role: 'Front Desk',   role_title: 'Front Desk Agent',            department: 'Front Office',    hourly_rate: 18.5, weekly_hours_max: 40, email: 'laura.kim@grandpacific.com',          phone: '(212) 555-0319', hire_date: '2021-04-22', site_id: siteH1, avatar_key: 'laura_gp' },
    { first_name: 'Marcus',     last_name: 'Johnson',    role: 'Front Desk',   role_title: 'Front Desk Agent',            department: 'Front Office',    hourly_rate: 18.0, weekly_hours_max: 40, email: 'marcus.johnson@grandpacific.com',     phone: '(212) 555-0320', hire_date: '2022-01-10', site_id: siteH1, avatar_key: 'marcus_gp' },
    { first_name: 'Emma',       last_name: 'Davis',      role: 'Front Desk',   role_title: 'Front Desk Agent',            department: 'Front Office',    hourly_rate: 18.0, weekly_hours_max: 40, email: 'emma.davis@grandpacific.com',         phone: '(212) 555-0321', hire_date: '2022-06-15', site_id: siteH1, avatar_key: 'emma_gp' },
    { first_name: 'Jason',      last_name: 'Chen',       role: 'Front Desk',   role_title: 'Night Auditor',               department: 'Front Office',    hourly_rate: 20.0, weekly_hours_max: 40, email: 'jason.chen@grandpacific.com',         phone: '(212) 555-0322', hire_date: '2021-09-28', site_id: siteH1, avatar_key: 'jason_gp' },
    { first_name: 'Olivia',     last_name: 'Brown',      role: 'Front Desk',   role_title: 'Front Desk Agent',            department: 'Front Office',    hourly_rate: 17.5, weekly_hours_max: 38, email: 'olivia.brown@grandpacific.com',       phone: '(212) 555-0323', hire_date: '2022-10-05', site_id: siteH1, avatar_key: 'olivia_gp' },
    { first_name: 'Ethan',      last_name: 'Wilson',     role: 'Front Desk',   role_title: 'Night Auditor',               department: 'Front Office',    hourly_rate: 19.5, weekly_hours_max: 40, email: 'ethan.wilson@grandpacific.com',       phone: '(212) 555-0324', hire_date: '2022-03-14', site_id: siteH1, avatar_key: 'ethan_gp' },
    { first_name: 'Lily',       last_name: 'Park',       role: 'Front Desk',   role_title: 'Front Desk Agent',            department: 'Front Office',    hourly_rate: 17.5, weekly_hours_max: 38, email: 'lily.park@grandpacific.com',          phone: '(212) 555-0325', hire_date: '2023-01-20', site_id: siteH1, avatar_key: 'lily_gp' },
    // Concierge & Guest Services (5)
    { first_name: 'Sophia',     last_name: 'Martinez',   role: 'Concierge',    role_title: 'Head Concierge',              department: 'Concierge',       hourly_rate: 22.0, weekly_hours_max: 40, email: 'sophia.martinez@grandpacific.com',    phone: '(212) 555-0326', hire_date: '2019-11-05', site_id: siteH1, avatar_key: 'sophia_gp' },
    { first_name: 'James',      last_name: 'Anderson',   role: 'Concierge',    role_title: 'Concierge',                   department: 'Concierge',       hourly_rate: 19.5, weekly_hours_max: 40, email: 'james.anderson@grandpacific.com',     phone: '(212) 555-0327', hire_date: '2021-06-18', site_id: siteH1, avatar_key: 'james_gp' },
    { first_name: 'Natalie',    last_name: 'Taylor',     role: 'Concierge',    role_title: 'Concierge',                   department: 'Concierge',       hourly_rate: 19.0, weekly_hours_max: 40, email: 'natalie.taylor@grandpacific.com',     phone: '(212) 555-0328', hire_date: '2022-02-28', site_id: siteH1, avatar_key: 'natalie_gp' },
    { first_name: 'Robert',     last_name: 'Hall',       role: 'Front Desk',   role_title: 'Bell Captain',                department: 'Front Office',    hourly_rate: 20.0, weekly_hours_max: 40, email: 'robert.hall@grandpacific.com',        phone: '(212) 555-0329', hire_date: '2020-07-14', site_id: siteH1, avatar_key: 'roberthall_gp' },
    { first_name: 'Daniel',     last_name: 'Kim',        role: 'Front Desk',   role_title: 'Bellhop',                     department: 'Front Office',    hourly_rate: 17.0, weekly_hours_max: 38, email: 'daniel.kim@grandpacific.com',         phone: '(212) 555-0330', hire_date: '2022-09-22', site_id: siteH1, avatar_key: 'daniel_gp' },
    // Housekeeping (20)
    { first_name: 'Uma',        last_name: 'Johnson',    role: 'Housekeeping', role_title: 'Housekeeping Supervisor',     department: 'Housekeeping',    hourly_rate: 21.5, weekly_hours_max: 42, email: 'uma.johnson@grandpacific.com',        phone: '(212) 555-0305', hire_date: '2018-07-22', site_id: siteH1, avatar_key: 'uma_gp' },
    { first_name: 'Tina',       last_name: 'Mitchell',   role: 'Housekeeping', role_title: 'Floor Supervisor',            department: 'Housekeeping',    hourly_rate: 19.0, weekly_hours_max: 40, email: 'tina.mitchell@grandpacific.com',      phone: '(212) 555-0304', hire_date: '2021-03-08', site_id: siteH1, avatar_key: 'tina_gp' },
    { first_name: 'Jennifer',   last_name: 'Lee',        role: 'Housekeeping', role_title: 'Floor Supervisor',            department: 'Housekeeping',    hourly_rate: 19.0, weekly_hours_max: 40, email: 'jennifer.lee@grandpacific.com',       phone: '(212) 555-0331', hire_date: '2022-01-17', site_id: siteH1, avatar_key: 'jennifer_gp' },
    { first_name: 'Maria',      last_name: 'Garcia',     role: 'Housekeeping', role_title: 'Housekeeping Inspector',      department: 'Housekeeping',    hourly_rate: 18.0, weekly_hours_max: 40, email: 'maria.garcia@grandpacific.com',       phone: '(212) 555-0332', hire_date: '2022-05-03', site_id: siteH1, avatar_key: 'maria_gp' },
    { first_name: 'Ana',        last_name: 'Lopez',      role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.5, weekly_hours_max: 40, email: 'ana.lopez@grandpacific.com',          phone: '(212) 555-0333', hire_date: '2020-10-12', site_id: siteH1, avatar_key: 'ana_gp' },
    { first_name: 'Rosa',       last_name: 'Martinez',   role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.5, weekly_hours_max: 40, email: 'rosa.martinez@grandpacific.com',      phone: '(212) 555-0334', hire_date: '2021-07-06', site_id: siteH1, avatar_key: 'rosa_gp' },
    { first_name: 'Linda',      last_name: 'Chen',       role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.5, weekly_hours_max: 40, email: 'linda.chen@grandpacific.com',         phone: '(212) 555-0335', hire_date: '2021-11-20', site_id: siteH1, avatar_key: 'linda_gp' },
    { first_name: 'Diana',      last_name: 'Park',       role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.5, weekly_hours_max: 40, email: 'diana.park@grandpacific.com',         phone: '(212) 555-0336', hire_date: '2022-03-28', site_id: siteH1, avatar_key: 'diana_gp' },
    { first_name: 'Julie',      last_name: 'Brown',      role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 38, email: 'julie.brown@grandpacific.com',        phone: '(212) 555-0337', hire_date: '2022-07-15', site_id: siteH1, avatar_key: 'julie_gp' },
    { first_name: 'Sarah',      last_name: 'White',      role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 38, email: 'sarah.white@grandpacific.com',        phone: '(212) 555-0338', hire_date: '2022-09-30', site_id: siteH1, avatar_key: 'sarah_gp' },
    { first_name: 'Jessica',    last_name: 'Davis',      role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 38, email: 'jessica.davis@grandpacific.com',      phone: '(212) 555-0339', hire_date: '2023-01-09', site_id: siteH1, avatar_key: 'jessica_gp' },
    { first_name: 'Amanda',     last_name: 'Wilson',     role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 38, email: 'amanda.wilson@grandpacific.com',      phone: '(212) 555-0340', hire_date: '2023-04-17', site_id: siteH1, avatar_key: 'amanda_gp' },
    { first_name: 'Kathy',      last_name: 'Taylor',     role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 38, email: 'kathy.taylor@grandpacific.com',       phone: '(212) 555-0341', hire_date: '2023-06-05', site_id: siteH1, avatar_key: 'kathy_gp' },
    { first_name: 'Nancy',      last_name: 'Rodriguez',  role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 38, email: 'nancy.rodriguez@grandpacific.com',    phone: '(212) 555-0342', hire_date: '2023-08-22', site_id: siteH1, avatar_key: 'nancy_gp' },
    { first_name: 'Barbara',    last_name: 'Collins',    role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 15.5, weekly_hours_max: 36, email: 'barbara.collins@grandpacific.com',    phone: '(212) 555-0343', hire_date: '2023-10-15', site_id: siteH1, avatar_key: 'barbara_gp' },
    { first_name: 'Sandra',     last_name: 'Phillips',   role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 15.5, weekly_hours_max: 36, email: 'sandra.phillips@grandpacific.com',    phone: '(212) 555-0344', hire_date: '2024-01-08', site_id: siteH1, avatar_key: 'sandra_gp' },
    { first_name: 'Dorothy',    last_name: 'Thompson',   role: 'Housekeeping', role_title: 'Laundry Supervisor',          department: 'Housekeeping',    hourly_rate: 18.0, weekly_hours_max: 40, email: 'dorothy.thompson@grandpacific.com',   phone: '(212) 555-0345', hire_date: '2020-12-01', site_id: siteH1, avatar_key: 'dorothy_gp' },
    { first_name: 'Helen',      last_name: 'Martinez',   role: 'Housekeeping', role_title: 'Laundry Attendant',           department: 'Housekeeping',    hourly_rate: 15.0, weekly_hours_max: 36, email: 'helen.martinez@grandpacific.com',     phone: '(212) 555-0346', hire_date: '2021-08-25', site_id: siteH1, avatar_key: 'helen_gp' },
    { first_name: 'Carol',      last_name: 'Parker',     role: 'Housekeeping', role_title: 'Public Area Cleaner',         department: 'Housekeeping',    hourly_rate: 15.0, weekly_hours_max: 36, email: 'carol.parker@grandpacific.com',       phone: '(212) 555-0347', hire_date: '2022-04-12', site_id: siteH1, avatar_key: 'carol_gp' },
    { first_name: 'Margaret',   last_name: 'Evans',      role: 'Housekeeping', role_title: 'Public Area Cleaner',         department: 'Housekeeping',    hourly_rate: 15.0, weekly_hours_max: 36, email: 'margaret.evans@grandpacific.com',     phone: '(212) 555-0348', hire_date: '2023-02-20', site_id: siteH1, avatar_key: 'margaret_gp' },
    // Restaurant Kitchen (9)
    { first_name: 'David',      last_name: 'Nguyen',     role: 'Kitchen',      role_title: 'Sous Chef',                   department: 'Kitchen',         hourly_rate: 23.0, weekly_hours_max: 42, email: 'david.nguyen@grandpacific.com',       phone: '(212) 555-0349', hire_date: '2020-08-10', site_id: siteH1, avatar_key: 'david_gp' },
    { first_name: 'Alice',      last_name: 'Park',       role: 'Kitchen',      role_title: 'Head Line Cook',              department: 'Kitchen',         hourly_rate: 19.0, weekly_hours_max: 40, email: 'alice.park@grandpacific.com',         phone: '(212) 555-0350', hire_date: '2021-05-15', site_id: siteH1, avatar_key: 'alicepark_gp' },
    { first_name: 'Kevin',      last_name: 'Torres',     role: 'Kitchen',      role_title: 'Line Cook',                   department: 'Kitchen',         hourly_rate: 17.5, weekly_hours_max: 40, email: 'kevin.torres@grandpacific.com',       phone: '(212) 555-0351', hire_date: '2022-03-20', site_id: siteH1, avatar_key: 'kevin_gp' },
    { first_name: 'Michelle',   last_name: 'Kim',        role: 'Kitchen',      role_title: 'Line Cook',                   department: 'Kitchen',         hourly_rate: 17.0, weekly_hours_max: 40, email: 'michelle.kim@grandpacific.com',       phone: '(212) 555-0352', hire_date: '2022-07-08', site_id: siteH1, avatar_key: 'michelle_gp' },
    { first_name: 'Brian',      last_name: 'Johnson',    role: 'Kitchen',      role_title: 'Prep Cook',                   department: 'Kitchen',         hourly_rate: 15.5, weekly_hours_max: 38, email: 'brian.johnson@grandpacific.com',      phone: '(212) 555-0353', hire_date: '2023-01-25', site_id: siteH1, avatar_key: 'brian_gp' },
    { first_name: 'Christine',  last_name: 'Adams',      role: 'Kitchen',      role_title: 'Prep Cook',                   department: 'Kitchen',         hourly_rate: 15.5, weekly_hours_max: 38, email: 'christine.adams@grandpacific.com',    phone: '(212) 555-0354', hire_date: '2023-05-14', site_id: siteH1, avatar_key: 'christine_gp' },
    { first_name: 'Steven',     last_name: 'White',      role: 'Kitchen',      role_title: 'Dishwasher',                  department: 'Kitchen',         hourly_rate: 14.0, weekly_hours_max: 35, email: 'steven.white@grandpacific.com',       phone: '(212) 555-0355', hire_date: '2023-09-01', site_id: siteH1, avatar_key: 'steven_gp' },
    { first_name: 'George',     last_name: 'Martinez',   role: 'Kitchen',      role_title: 'Dishwasher',                  department: 'Kitchen',         hourly_rate: 14.0, weekly_hours_max: 35, email: 'george.martinez@grandpacific.com',    phone: '(212) 555-0356', hire_date: '2024-01-22', site_id: siteH1, avatar_key: 'georgemartinez_gp' },
    { first_name: 'Patricia',   last_name: 'Morris',     role: 'Kitchen',      role_title: 'Pastry Chef',                 department: 'Kitchen',         hourly_rate: 20.0, weekly_hours_max: 40, email: 'patricia.morris@grandpacific.com',    phone: '(212) 555-0357', hire_date: '2021-10-18', site_id: siteH1, avatar_key: 'patriciam_gp' },
    // Restaurant F&B (8)
    { first_name: 'Tommy',      last_name: 'Chen',       role: 'F&B',          role_title: 'Lead Server',                 department: 'Food & Beverage', hourly_rate: 17.0, weekly_hours_max: 40, email: 'tommy.chen@grandpacific.com',         phone: '(212) 555-0358', hire_date: '2020-11-10', site_id: siteH1, avatar_key: 'tommy_gp' },
    { first_name: 'Ashley',     last_name: 'Davis',      role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 15.0, weekly_hours_max: 38, email: 'ashley.davis@grandpacific.com',       phone: '(212) 555-0359', hire_date: '2021-07-22', site_id: siteH1, avatar_key: 'ashley_gp' },
    { first_name: 'Brandon',    last_name: 'Wilson',     role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 14.5, weekly_hours_max: 38, email: 'brandon.wilson@grandpacific.com',     phone: '(212) 555-0360', hire_date: '2022-02-08', site_id: siteH1, avatar_key: 'brandon_gp' },
    { first_name: 'Megan',      last_name: 'Taylor',     role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 14.5, weekly_hours_max: 36, email: 'megan.taylor@grandpacific.com',       phone: '(212) 555-0361', hire_date: '2022-10-20', site_id: siteH1, avatar_key: 'megan_gp' },
    { first_name: 'Kyle',       last_name: 'Martin',     role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 14.0, weekly_hours_max: 36, email: 'kyle.martin@grandpacific.com',        phone: '(212) 555-0362', hire_date: '2023-03-12', site_id: siteH1, avatar_key: 'kyle_gp' },
    { first_name: 'Lauren',     last_name: 'Anderson',   role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 14.0, weekly_hours_max: 36, email: 'lauren.anderson@grandpacific.com',    phone: '(212) 555-0363', hire_date: '2023-07-15', site_id: siteH1, avatar_key: 'lauren_gp' },
    { first_name: 'Nicole',     last_name: 'Thomas',     role: 'F&B',          role_title: 'Hostess',                     department: 'Food & Beverage', hourly_rate: 16.0, weekly_hours_max: 36, email: 'nicole.thomas@grandpacific.com',      phone: '(212) 555-0364', hire_date: '2022-11-28', site_id: siteH1, avatar_key: 'nicole_gp' },
    { first_name: 'Rachel',     last_name: 'Clark',      role: 'F&B',          role_title: 'Hostess',                     department: 'Food & Beverage', hourly_rate: 15.5, weekly_hours_max: 34, email: 'rachel.clark@grandpacific.com',       phone: '(212) 555-0365', hire_date: '2023-06-10', site_id: siteH1, avatar_key: 'rachelclark_gp' },
    // Bar (5)
    { first_name: 'Jason',      last_name: 'Lee',        role: 'Bar',          role_title: 'Head Bartender',              department: 'Food & Beverage', hourly_rate: 20.0, weekly_hours_max: 40, email: 'jason.lee@grandpacific.com',          phone: '(212) 555-0366', hire_date: '2020-05-25', site_id: siteH1, avatar_key: 'jasonlee_gp' },
    { first_name: 'Brittany',   last_name: 'Johnson',    role: 'Bar',          role_title: 'Bartender',                   department: 'Food & Beverage', hourly_rate: 17.0, weekly_hours_max: 38, email: 'brittany.johnson@grandpacific.com',   phone: '(212) 555-0367', hire_date: '2021-12-15', site_id: siteH1, avatar_key: 'brittany_gp' },
    { first_name: 'Ryan',       last_name: 'Martinez',   role: 'Bar',          role_title: 'Bartender',                   department: 'Food & Beverage', hourly_rate: 17.0, weekly_hours_max: 38, email: 'ryan.martinez@grandpacific.com',      phone: '(212) 555-0368', hire_date: '2022-08-30', site_id: siteH1, avatar_key: 'ryanmartinez_gp' },
    { first_name: 'Amber',      last_name: 'Wilson',     role: 'Bar',          role_title: 'Bar Server',                  department: 'Food & Beverage', hourly_rate: 15.0, weekly_hours_max: 36, email: 'amber.wilson@grandpacific.com',       phone: '(212) 555-0369', hire_date: '2023-04-05', site_id: siteH1, avatar_key: 'amberwilson_gp' },
    { first_name: 'Carlos',     last_name: 'Garcia',     role: 'Bar',          role_title: 'Barback',                     department: 'Food & Beverage', hourly_rate: 13.5, weekly_hours_max: 32, email: 'carlos.garcia@grandpacific.com',      phone: '(212) 555-0370', hire_date: '2023-11-18', site_id: siteH1, avatar_key: 'carlosgarcia_gp' },
    // Banquet/Events (5)
    { first_name: 'Rebecca',    last_name: 'Torres',     role: 'F&B',          role_title: 'Banquet Captain',             department: 'Food & Beverage', hourly_rate: 21.0, weekly_hours_max: 40, email: 'rebecca.torres@grandpacific.com',     phone: '(212) 555-0371', hire_date: '2020-09-08', site_id: siteH1, avatar_key: 'rebecca_gp' },
    { first_name: 'Christopher',last_name: 'Kim',        role: 'F&B',          role_title: 'Banquet Server',              department: 'Food & Beverage', hourly_rate: 15.0, weekly_hours_max: 36, email: 'christopher.kim@grandpacific.com',    phone: '(212) 555-0372', hire_date: '2022-04-22', site_id: siteH1, avatar_key: 'christopherkim_gp' },
    { first_name: 'Teresa',     last_name: 'Martinez',   role: 'F&B',          role_title: 'Banquet Server',              department: 'Food & Beverage', hourly_rate: 15.0, weekly_hours_max: 36, email: 'teresa.martinez@grandpacific.com',    phone: '(212) 555-0373', hire_date: '2022-12-05', site_id: siteH1, avatar_key: 'teresa_gp' },
    { first_name: 'Marcus',     last_name: 'Brown',      role: 'F&B',          role_title: 'Banquet Server',              department: 'Food & Beverage', hourly_rate: 15.0, weekly_hours_max: 36, email: 'marcus.brown@grandpacific.com',       phone: '(212) 555-0374', hire_date: '2023-06-28', site_id: siteH1, avatar_key: 'marcusbrown_gp' },
    { first_name: 'Katelyn',    last_name: 'Davis',      role: 'F&B',          role_title: 'Event Coordinator',           department: 'Food & Beverage', hourly_rate: 19.0, weekly_hours_max: 40, email: 'katelyn.davis@grandpacific.com',      phone: '(212) 555-0375', hire_date: '2021-08-12', site_id: siteH1, avatar_key: 'katelyn_gp' },
    // Engineering (4)
    { first_name: 'Frank',      last_name: 'Torres',     role: 'Maintenance',  role_title: 'Senior Maintenance Tech',     department: 'Engineering',     hourly_rate: 22.0, weekly_hours_max: 40, email: 'frank.torres@grandpacific.com',       phone: '(212) 555-0376', hire_date: '2021-04-05', site_id: siteH1, avatar_key: 'frank_gp' },
    { first_name: 'Gary',       last_name: 'Anderson',   role: 'Maintenance',  role_title: 'Maintenance Technician',      department: 'Engineering',     hourly_rate: 20.5, weekly_hours_max: 40, email: 'gary.anderson@grandpacific.com',      phone: '(212) 555-0377', hire_date: '2022-02-28', site_id: siteH1, avatar_key: 'gary_gp' },
    { first_name: 'Harold',     last_name: 'Wilson',     role: 'Maintenance',  role_title: 'Electrical/HVAC Technician',  department: 'Engineering',     hourly_rate: 22.0, weekly_hours_max: 40, email: 'harold.wilson@grandpacific.com',      phone: '(212) 555-0378', hire_date: '2021-11-16', site_id: siteH1, avatar_key: 'harold_gp' },
    { first_name: 'Irene',      last_name: 'Park',       role: 'Maintenance',  role_title: 'Facilities Coordinator',      department: 'Engineering',     hourly_rate: 18.0, weekly_hours_max: 38, email: 'irene.park@grandpacific.com',         phone: '(212) 555-0379', hire_date: '2022-08-10', site_id: siteH1, avatar_key: 'irene_gp' },
    // Security (3)
    { first_name: 'Patricia',   last_name: 'Lee',        role: 'Security',     role_title: 'Security Officer',            department: 'Security',        hourly_rate: 18.0, weekly_hours_max: 40, email: 'patricia.lee@grandpacific.com',       phone: '(212) 555-0380', hire_date: '2020-03-20', site_id: siteH1, avatar_key: 'patricialee_gp' },
    { first_name: 'Michael',    last_name: 'Brown',      role: 'Security',     role_title: 'Security Officer',            department: 'Security',        hourly_rate: 18.0, weekly_hours_max: 40, email: 'michael.brown@grandpacific.com',      phone: '(212) 555-0381', hire_date: '2021-10-12', site_id: siteH1, avatar_key: 'michaelbrown_gp' },
    { first_name: 'Sandra',     last_name: 'Collins',    role: 'Security',     role_title: 'Security Officer',            department: 'Security',        hourly_rate: 17.5, weekly_hours_max: 38, email: 'sandra.collins@grandpacific.com',     phone: '(212) 555-0382', hire_date: '2022-06-05', site_id: siteH1, avatar_key: 'sandracollins_gp' },
    // Spa/Recreation (4)
    { first_name: 'Amy',        last_name: 'Foster',     role: 'Spa',          role_title: 'Spa & Recreation Manager',    department: 'Spa',             hourly_rate: 22.0, weekly_hours_max: 40, email: 'amy.foster@grandpacific.com',         phone: '(212) 555-0383', hire_date: '2020-06-05', site_id: siteH1, avatar_key: 'amy_gp' },
    { first_name: 'Crystal',    last_name: 'Park',       role: 'Spa',          role_title: 'Massage Therapist',           department: 'Spa',             hourly_rate: 20.0, weekly_hours_max: 38, email: 'crystal.park@grandpacific.com',       phone: '(212) 555-0384', hire_date: '2021-09-15', site_id: siteH1, avatar_key: 'crystal_gp' },
    { first_name: 'Monica',     last_name: 'Brown',      role: 'Spa',          role_title: 'Fitness Attendant',           department: 'Spa',             hourly_rate: 16.0, weekly_hours_max: 36, email: 'monica.brown@grandpacific.com',       phone: '(212) 555-0385', hire_date: '2022-10-28', site_id: siteH1, avatar_key: 'monica_gp' },
    { first_name: 'Kevin',      last_name: 'Ross',       role: 'Spa',          role_title: 'Pool Attendant',              department: 'Spa',             hourly_rate: 15.0, weekly_hours_max: 35, email: 'kevin.ross@grandpacific.com',         phone: '(212) 555-0386', hire_date: '2023-05-08', site_id: siteH1, avatar_key: 'kevinross_gp' },
    // Administration (3)
    { first_name: 'Andrew',     last_name: 'Garcia',     role: 'Front Desk',   role_title: 'Reservations Coordinator',    department: 'Administration',  hourly_rate: 18.0, weekly_hours_max: 38, email: 'andrew.garcia@grandpacific.com',      phone: '(212) 555-0387', hire_date: '2021-06-22', site_id: siteH1, avatar_key: 'andrew_gp' },
    { first_name: 'Barbara',    last_name: 'Martinez',   role: 'Front Desk',   role_title: 'Accounting Clerk',            department: 'Administration',  hourly_rate: 18.0, weekly_hours_max: 38, email: 'barbara.martinez@grandpacific.com',   phone: '(212) 555-0388', hire_date: '2022-02-14', site_id: siteH1, avatar_key: 'barbaramartinez_gp' },
    { first_name: 'Tim',        last_name: 'Cooper',     role: 'Front Desk',   role_title: 'Night Porter',                department: 'Front Office',    hourly_rate: 16.5, weekly_hours_max: 38, email: 'tim.cooper@grandpacific.com',         phone: '(212) 555-0389', hire_date: '2022-01-30', site_id: siteH1, avatar_key: 'tim_gp' },

    // ════════════════════════════════════════════════════════════════════════
    // SEASIDE SUITES & SPA — 150-room hotel + spa, Miami FL (~87 employees)
    // ════════════════════════════════════════════════════════════════════════
    // Senior Management (7)
    { first_name: 'Yara',       last_name: 'Davis',      role: 'Manager',      role_title: 'General Manager',             department: 'Management',      hourly_rate: 36.0, weekly_hours_max: 50, email: 'yara.davis@seasidesuites.com',        phone: '(305) 555-0401', hire_date: '2017-10-10', site_id: siteH2, avatar_key: 'yara_ss' },
    { first_name: 'William',    last_name: 'Foster',     role: 'Manager',      role_title: 'Assistant General Manager',   department: 'Management',      hourly_rate: 32.0, weekly_hours_max: 48, email: 'william.foster@seasidesuites.com',    phone: '(305) 555-0408', hire_date: '2019-04-20', site_id: siteH2, avatar_key: 'william_ss' },
    { first_name: 'Catherine',  last_name: 'Reyes',      role: 'Manager',      role_title: 'Financial Controller',        department: 'Management',      hourly_rate: 30.0, weekly_hours_max: 45, email: 'catherine.reyes@seasidesuites.com',   phone: '(305) 555-0409', hire_date: '2020-07-12', site_id: siteH2, avatar_key: 'catherine_ss' },
    { first_name: 'Robert',     last_name: 'James',      role: 'Manager',      role_title: 'F&B Director',                department: 'Management',      hourly_rate: 31.0, weekly_hours_max: 48, email: 'robert.james@seasidesuites.com',      phone: '(305) 555-0410', hire_date: '2018-11-15', site_id: siteH2, avatar_key: 'robertj_ss' },
    { first_name: 'Steven',     last_name: 'Park',       role: 'Manager',      role_title: 'Director of Sales & Marketing',department: 'Management',     hourly_rate: 29.0, weekly_hours_max: 45, email: 'steven.park@seasidesuites.com',       phone: '(305) 555-0411', hire_date: '2021-01-08', site_id: siteH2, avatar_key: 'stevenp_ss' },
    { first_name: 'Angela',     last_name: 'Torres',     role: 'Manager',      role_title: 'Spa Director',                department: 'Management',      hourly_rate: 28.0, weekly_hours_max: 45, email: 'angela.torres@seasidesuites.com',     phone: '(305) 555-0412', hire_date: '2019-08-25', site_id: siteH2, avatar_key: 'angela_ss' },
    { first_name: 'Elena',      last_name: 'Kim',        role: 'Manager',      role_title: 'Chief Engineer',              department: 'Management',      hourly_rate: 27.0, weekly_hours_max: 45, email: 'elena.kim@seasidesuites.com',         phone: '(305) 555-0407', hire_date: '2021-11-09', site_id: siteH2, avatar_key: 'elena_ss' },
    // Rooms Division Management (3)
    { first_name: 'Pamela',     last_name: 'Brooks',     role: 'Manager',      role_title: 'Front Office Manager',        department: 'Management',      hourly_rate: 26.0, weekly_hours_max: 45, email: 'pamela.brooks@seasidesuites.com',     phone: '(305) 555-0413', hire_date: '2020-05-18', site_id: siteH2, avatar_key: 'pamela_ss' },
    { first_name: 'Clara',      last_name: 'Nguyen',     role: 'Manager',      role_title: 'Executive Housekeeper',       department: 'Management',      hourly_rate: 25.0, weekly_hours_max: 45, email: 'clara.nguyen@seasidesuites.com',      phone: '(305) 555-0405', hire_date: '2023-02-07', site_id: siteH2, avatar_key: 'clara_ss' },
    { first_name: 'Carlos',     last_name: 'Medina',     role: 'Manager',      role_title: 'Guest Services Manager',      department: 'Management',      hourly_rate: 25.0, weekly_hours_max: 45, email: 'carlos.medina@seasidesuites.com',     phone: '(305) 555-0414', hire_date: '2021-09-14', site_id: siteH2, avatar_key: 'carlosm_ss' },
    // F&B Management (3)
    { first_name: 'Felix',      last_name: 'Garcia',     role: 'Manager',      role_title: 'Restaurant Manager',          department: 'Management',      hourly_rate: 25.0, weekly_hours_max: 45, email: 'felix.garcia@seasidesuites.com',      phone: '(305) 555-0408', hire_date: '2023-06-20', site_id: siteH2, avatar_key: 'felix_ss' },
    { first_name: 'Victoria',   last_name: 'Park',       role: 'Manager',      role_title: 'Executive Chef',              department: 'Management',      hourly_rate: 27.0, weekly_hours_max: 45, email: 'victoria.park@seasidesuites.com',     phone: '(305) 555-0415', hire_date: '2019-12-03', site_id: siteH2, avatar_key: 'victoriap_ss' },
    { first_name: 'Noah',       last_name: 'Walsh',      role: 'Manager',      role_title: 'Pool Bar & Beach Manager',    department: 'Management',      hourly_rate: 24.0, weekly_hours_max: 45, email: 'noah.walsh@seasidesuites.com',        phone: '(305) 555-0416', hire_date: '2020-09-22', site_id: siteH2, avatar_key: 'noahw_ss' },
    // Security & Spa Management (2)
    { first_name: 'Richard',    last_name: 'Thompson',   role: 'Manager',      role_title: 'Security Manager',            department: 'Management',      hourly_rate: 25.0, weekly_hours_max: 45, email: 'richard.thompson@seasidesuites.com',  phone: '(305) 555-0417', hire_date: '2020-02-17', site_id: siteH2, avatar_key: 'richard_ss' },
    { first_name: 'Samantha',   last_name: 'Lee',        role: 'Manager',      role_title: 'Spa Manager',                 department: 'Management',      hourly_rate: 23.0, weekly_hours_max: 43, email: 'samantha.lee@seasidesuites.com',      phone: '(305) 555-0418', hire_date: '2021-05-30', site_id: siteH2, avatar_key: 'samanthal_ss' },
    // Front Office (8)
    { first_name: 'Zach',       last_name: 'Wilson',     role: 'Front Desk',   role_title: 'Front Desk Supervisor',       department: 'Front Office',    hourly_rate: 22.0, weekly_hours_max: 40, email: 'zach.wilson@seasidesuites.com',       phone: '(305) 555-0402', hire_date: '2021-01-25', site_id: siteH2, avatar_key: 'zach_ss' },
    { first_name: 'Amy',        last_name: 'Taylor',     role: 'Front Desk',   role_title: 'Night Audit Supervisor',      department: 'Front Office',    hourly_rate: 22.5, weekly_hours_max: 40, email: 'amy.taylor@seasidesuites.com',        phone: '(305) 555-0403', hire_date: '2020-08-18', site_id: siteH2, avatar_key: 'amy_ss' },
    { first_name: 'Jennifer',   last_name: 'Moore',      role: 'Front Desk',   role_title: 'Front Desk Agent',            department: 'Front Office',    hourly_rate: 18.0, weekly_hours_max: 40, email: 'jennifer.moore@seasidesuites.com',    phone: '(305) 555-0419', hire_date: '2022-03-14', site_id: siteH2, avatar_key: 'jennifer_ss' },
    { first_name: 'Kevin',      last_name: 'Park',       role: 'Front Desk',   role_title: 'Front Desk Agent',            department: 'Front Office',    hourly_rate: 17.5, weekly_hours_max: 40, email: 'kevin.park@seasidesuites.com',        phone: '(305) 555-0420', hire_date: '2022-07-20', site_id: siteH2, avatar_key: 'kevinp_ss' },
    { first_name: 'Melissa',    last_name: 'Torres',     role: 'Front Desk',   role_title: 'Front Desk Agent',            department: 'Front Office',    hourly_rate: 17.5, weekly_hours_max: 40, email: 'melissa.torres@seasidesuites.com',    phone: '(305) 555-0421', hire_date: '2022-11-08', site_id: siteH2, avatar_key: 'melissa_ss' },
    { first_name: 'Anthony',    last_name: 'Kim',        role: 'Front Desk',   role_title: 'Night Auditor',               department: 'Front Office',    hourly_rate: 19.5, weekly_hours_max: 40, email: 'anthony.kim@seasidesuites.com',       phone: '(305) 555-0422', hire_date: '2022-09-15', site_id: siteH2, avatar_key: 'anthonyk_ss' },
    { first_name: 'Rachel',     last_name: 'Brooks',     role: 'Front Desk',   role_title: 'Front Desk Agent',            department: 'Front Office',    hourly_rate: 17.0, weekly_hours_max: 38, email: 'rachel.brooks@seasidesuites.com',     phone: '(305) 555-0423', hire_date: '2023-04-25', site_id: siteH2, avatar_key: 'rachelb_ss' },
    { first_name: 'Nathan',     last_name: 'Chen',       role: 'Front Desk',   role_title: 'Night Auditor',               department: 'Front Office',    hourly_rate: 19.0, weekly_hours_max: 40, email: 'nathan.chen@seasidesuites.com',       phone: '(305) 555-0424', hire_date: '2023-01-10', site_id: siteH2, avatar_key: 'nathanc_ss' },
    // Concierge & Guest Services (5)
    { first_name: 'Isabella',   last_name: 'Rodriguez',  role: 'Concierge',    role_title: 'Head Concierge',              department: 'Concierge',       hourly_rate: 21.0, weekly_hours_max: 40, email: 'isabella.rodriguez@seasidesuites.com',phone: '(305) 555-0425', hire_date: '2020-03-15', site_id: siteH2, avatar_key: 'isabella_ss' },
    { first_name: 'Patrick',    last_name: 'Wilson',     role: 'Concierge',    role_title: 'Concierge',                   department: 'Concierge',       hourly_rate: 19.0, weekly_hours_max: 40, email: 'patrick.wilson@seasidesuites.com',    phone: '(305) 555-0426', hire_date: '2021-11-22', site_id: siteH2, avatar_key: 'patrickw_ss' },
    { first_name: 'Sophie',     last_name: 'Lee',        role: 'Concierge',    role_title: 'Concierge',                   department: 'Concierge',       hourly_rate: 18.5, weekly_hours_max: 40, email: 'sophie.lee@seasidesuites.com',        phone: '(305) 555-0427', hire_date: '2022-06-08', site_id: siteH2, avatar_key: 'sophiee_ss' },
    { first_name: 'Marco',      last_name: 'Hernandez',  role: 'Front Desk',   role_title: 'Bell Captain',                department: 'Front Office',    hourly_rate: 20.0, weekly_hours_max: 40, email: 'marco.hernandez@seasidesuites.com',   phone: '(305) 555-0428', hire_date: '2021-07-30', site_id: siteH2, avatar_key: 'marco_ss' },
    { first_name: 'Jasmine',    last_name: 'Taylor',     role: 'Front Desk',   role_title: 'Bellhop',                     department: 'Front Office',    hourly_rate: 16.5, weekly_hours_max: 38, email: 'jasmine.taylor@seasidesuites.com',    phone: '(305) 555-0429', hire_date: '2022-12-15', site_id: siteH2, avatar_key: 'jasmine_ss' },
    // Housekeeping (18)
    { first_name: 'Maria',      last_name: 'Santos',     role: 'Housekeeping', role_title: 'Housekeeping Supervisor',     department: 'Housekeeping',    hourly_rate: 20.5, weekly_hours_max: 42, email: 'maria.santos@seasidesuites.com',      phone: '(305) 555-0430', hire_date: '2019-06-10', site_id: siteH2, avatar_key: 'mariasantos_ss' },
    { first_name: 'Diana',      last_name: 'Park',       role: 'Housekeeping', role_title: 'Floor Supervisor',            department: 'Housekeeping',    hourly_rate: 18.5, weekly_hours_max: 40, email: 'diana.park@seasidesuites.com',        phone: '(305) 555-0431', hire_date: '2020-11-28', site_id: siteH2, avatar_key: 'dianap_ss' },
    { first_name: 'Lisa',       last_name: 'Wang',       role: 'Housekeeping', role_title: 'Floor Supervisor',            department: 'Housekeeping',    hourly_rate: 18.5, weekly_hours_max: 40, email: 'lisa.wang@seasidesuites.com',         phone: '(305) 555-0432', hire_date: '2021-04-15', site_id: siteH2, avatar_key: 'lisawang_ss' },
    { first_name: 'Ben',        last_name: 'Martinez',   role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 40, email: 'ben.martinez@seasidesuites.com',      phone: '(305) 555-0404', hire_date: '2022-05-02', site_id: siteH2, avatar_key: 'ben_ss' },
    { first_name: 'Patricia',   last_name: 'Cruz',       role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 40, email: 'patricia.cruz@seasidesuites.com',     phone: '(305) 555-0433', hire_date: '2021-10-20', site_id: siteH2, avatar_key: 'patriciac_ss' },
    { first_name: 'Carmen',     last_name: 'Lopez',      role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 40, email: 'carmen.lopez@seasidesuites.com',      phone: '(305) 555-0434', hire_date: '2022-02-14', site_id: siteH2, avatar_key: 'carmen_ss' },
    { first_name: 'Rosa',       last_name: 'Chen',       role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 16.0, weekly_hours_max: 40, email: 'rosa.chen@seasidesuites.com',         phone: '(305) 555-0435', hire_date: '2022-08-05', site_id: siteH2, avatar_key: 'rosachen_ss' },
    { first_name: 'Sandra',     last_name: 'Torres',     role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 15.5, weekly_hours_max: 38, email: 'sandra.torres@seasidesuites.com',     phone: '(305) 555-0436', hire_date: '2022-10-28', site_id: siteH2, avatar_key: 'sandrat_ss' },
    { first_name: 'Linda',      last_name: 'Kim',        role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 15.5, weekly_hours_max: 38, email: 'linda.kim@seasidesuites.com',         phone: '(305) 555-0437', hire_date: '2023-01-30', site_id: siteH2, avatar_key: 'linda_ss' },
    { first_name: 'Kathy',      last_name: 'Martinez',   role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 15.5, weekly_hours_max: 38, email: 'kathy.martinez@seasidesuites.com',    phone: '(305) 555-0438', hire_date: '2023-04-12', site_id: siteH2, avatar_key: 'kathym_ss' },
    { first_name: 'Nancy',      last_name: 'Wilson',     role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 15.5, weekly_hours_max: 38, email: 'nancy.wilson@seasidesuites.com',      phone: '(305) 555-0439', hire_date: '2023-07-05', site_id: siteH2, avatar_key: 'nancyw_ss' },
    { first_name: 'Barbara',    last_name: 'Davis',      role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 15.0, weekly_hours_max: 36, email: 'barbara.davis@seasidesuites.com',     phone: '(305) 555-0440', hire_date: '2023-09-20', site_id: siteH2, avatar_key: 'barbarad_ss' },
    { first_name: 'Dorothy',    last_name: 'Evans',      role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 15.0, weekly_hours_max: 36, email: 'dorothy.evans@seasidesuites.com',     phone: '(305) 555-0441', hire_date: '2023-11-08', site_id: siteH2, avatar_key: 'dorothy_ss' },
    { first_name: 'Helen',      last_name: 'Brooks',     role: 'Housekeeping', role_title: 'Room Attendant',              department: 'Housekeeping',    hourly_rate: 15.0, weekly_hours_max: 36, email: 'helen.brooks@seasidesuites.com',      phone: '(305) 555-0442', hire_date: '2024-01-15', site_id: siteH2, avatar_key: 'helenb_ss' },
    { first_name: 'Christine',  last_name: 'Santos',     role: 'Housekeeping', role_title: 'Laundry Supervisor',          department: 'Housekeeping',    hourly_rate: 17.5, weekly_hours_max: 40, email: 'christine.santos@seasidesuites.com',  phone: '(305) 555-0443', hire_date: '2020-07-25', site_id: siteH2, avatar_key: 'christines_ss' },
    { first_name: 'Teresa',     last_name: 'Lopez',      role: 'Housekeeping', role_title: 'Laundry Attendant',           department: 'Housekeeping',    hourly_rate: 15.0, weekly_hours_max: 36, email: 'teresa.lopez@seasidesuites.com',      phone: '(305) 555-0444', hire_date: '2021-12-10', site_id: siteH2, avatar_key: 'teresar_ss' },
    { first_name: 'Carlos',     last_name: 'Rivera',     role: 'Housekeeping', role_title: 'Public Area Cleaner',         department: 'Housekeeping',    hourly_rate: 14.5, weekly_hours_max: 36, email: 'carlos.rivera@seasidesuites.com',     phone: '(305) 555-0445', hire_date: '2022-09-18', site_id: siteH2, avatar_key: 'carlosr_ss' },
    { first_name: 'Marcus',     last_name: 'Reed',       role: 'Housekeeping', role_title: 'Public Area Cleaner',         department: 'Housekeeping',    hourly_rate: 14.5, weekly_hours_max: 36, email: 'marcus.reed@seasidesuites.com',       phone: '(305) 555-0446', hire_date: '2023-03-18', site_id: siteH2, avatar_key: 'marcus_ss' },
    // Restaurant Kitchen (8)
    { first_name: 'Antonio',    last_name: 'Reyes',      role: 'Kitchen',      role_title: 'Sous Chef',                   department: 'Kitchen',         hourly_rate: 22.0, weekly_hours_max: 42, email: 'antonio.reyes@seasidesuites.com',     phone: '(305) 555-0447', hire_date: '2020-10-05', site_id: siteH2, avatar_key: 'antonio_ss' },
    { first_name: 'Priya',      last_name: 'Sharma',     role: 'Kitchen',      role_title: 'Line Cook',                   department: 'Kitchen',         hourly_rate: 17.0, weekly_hours_max: 40, email: 'priya.sharma@seasidesuites.com',      phone: '(305) 555-0448', hire_date: '2022-04-28', site_id: siteH2, avatar_key: 'priya_ss' },
    { first_name: 'Tyler',      last_name: 'Johnson',    role: 'Kitchen',      role_title: 'Line Cook',                   department: 'Kitchen',         hourly_rate: 16.5, weekly_hours_max: 40, email: 'tyler.johnson@seasidesuites.com',     phone: '(305) 555-0449', hire_date: '2022-08-16', site_id: siteH2, avatar_key: 'tyler_ss' },
    { first_name: 'Mandy',      last_name: 'Chen',       role: 'Kitchen',      role_title: 'Line Cook',                   department: 'Kitchen',         hourly_rate: 16.5, weekly_hours_max: 40, email: 'mandy.chen@seasidesuites.com',        phone: '(305) 555-0450', hire_date: '2023-02-22', site_id: siteH2, avatar_key: 'mandy_ss' },
    { first_name: 'Jose',       last_name: 'Rodriguez',  role: 'Kitchen',      role_title: 'Prep Cook',                   department: 'Kitchen',         hourly_rate: 15.0, weekly_hours_max: 38, email: 'jose.rodriguez@seasidesuites.com',    phone: '(305) 555-0451', hire_date: '2023-05-30', site_id: siteH2, avatar_key: 'jose_ss' },
    { first_name: 'Melissa',    last_name: 'Wong',       role: 'Kitchen',      role_title: 'Prep Cook',                   department: 'Kitchen',         hourly_rate: 15.0, weekly_hours_max: 38, email: 'melissa.wong@seasidesuites.com',      phone: '(305) 555-0452', hire_date: '2023-09-12', site_id: siteH2, avatar_key: 'melissawong_ss' },
    { first_name: 'Eric',       last_name: 'Martinez',   role: 'Kitchen',      role_title: 'Dishwasher',                  department: 'Kitchen',         hourly_rate: 13.5, weekly_hours_max: 35, email: 'eric.martinez@seasidesuites.com',     phone: '(305) 555-0453', hire_date: '2023-11-25', site_id: siteH2, avatar_key: 'ericm_ss' },
    { first_name: 'Tammy',      last_name: 'Brown',      role: 'Kitchen',      role_title: 'Dishwasher',                  department: 'Kitchen',         hourly_rate: 13.5, weekly_hours_max: 32, email: 'tammy.brown@seasidesuites.com',       phone: '(305) 555-0454', hire_date: '2024-02-05', site_id: siteH2, avatar_key: 'tammy_ss' },
    // Restaurant F&B (8)
    { first_name: 'Dan',        last_name: 'Roberts',    role: 'F&B',          role_title: 'Lead Server',                 department: 'Food & Beverage', hourly_rate: 17.0, weekly_hours_max: 38, email: 'dan.roberts@seasidesuites.com',       phone: '(305) 555-0406', hire_date: '2022-03-14', site_id: siteH2, avatar_key: 'dan_ss' },
    { first_name: 'Stephanie',  last_name: 'Wilson',     role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 14.5, weekly_hours_max: 36, email: 'stephanie.wilson@seasidesuites.com',  phone: '(305) 555-0455', hire_date: '2022-07-28', site_id: siteH2, avatar_key: 'stephaniew_ss' },
    { first_name: 'Michael',    last_name: 'Rivera',     role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 14.5, weekly_hours_max: 36, email: 'michael.rivera@seasidesuites.com',    phone: '(305) 555-0456', hire_date: '2022-11-15', site_id: siteH2, avatar_key: 'michaelr_ss' },
    { first_name: 'Karen',      last_name: 'Park',       role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 14.0, weekly_hours_max: 36, email: 'karen.park@seasidesuites.com',        phone: '(305) 555-0457', hire_date: '2023-03-20', site_id: siteH2, avatar_key: 'karenp_ss' },
    { first_name: 'Thomas',     last_name: 'Chen',       role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 14.0, weekly_hours_max: 36, email: 'thomas.chen@seasidesuites.com',       phone: '(305) 555-0458', hire_date: '2023-06-08', site_id: siteH2, avatar_key: 'thomasc_ss' },
    { first_name: 'Aisha',      last_name: 'Johnson',    role: 'F&B',          role_title: 'Server',                      department: 'Food & Beverage', hourly_rate: 13.5, weekly_hours_max: 35, email: 'aisha.johnson@seasidesuites.com',     phone: '(305) 555-0459', hire_date: '2023-09-25', site_id: siteH2, avatar_key: 'aisha_ss' },
    { first_name: 'Roberto',    last_name: 'Martinez',   role: 'F&B',          role_title: 'Host',                        department: 'Food & Beverage', hourly_rate: 15.5, weekly_hours_max: 34, email: 'roberto.martinez@seasidesuites.com',  phone: '(305) 555-0460', hire_date: '2022-06-14', site_id: siteH2, avatar_key: 'roberto_ss' },
    { first_name: 'Nadia',      last_name: 'Kim',        role: 'F&B',          role_title: 'Hostess',                     department: 'Food & Beverage', hourly_rate: 15.0, weekly_hours_max: 32, email: 'nadia.kim@seasidesuites.com',         phone: '(305) 555-0461', hire_date: '2023-08-01', site_id: siteH2, avatar_key: 'nadia_ss' },
    // Pool/Beach Bar (5)
    { first_name: 'Sofia',      last_name: 'Hernandez',  role: 'Bar',          role_title: 'Head Bartender (Pool Bar)',    department: 'Food & Beverage', hourly_rate: 17.0, weekly_hours_max: 38, email: 'sofia.hernandez@seasidesuites.com',   phone: '(305) 555-0462', hire_date: '2021-06-15', site_id: siteH2, avatar_key: 'sofiah_ss' },
    { first_name: 'Jackson',    last_name: 'Lee',        role: 'Bar',          role_title: 'Bartender (Pool Bar)',         department: 'Food & Beverage', hourly_rate: 16.5, weekly_hours_max: 38, email: 'jackson.lee@seasidesuites.com',       phone: '(305) 555-0463', hire_date: '2022-04-10', site_id: siteH2, avatar_key: 'jacksonl_ss' },
    { first_name: 'Daisy',      last_name: 'Chen',       role: 'F&B',          role_title: 'Poolside Server',             department: 'Food & Beverage', hourly_rate: 13.5, weekly_hours_max: 36, email: 'daisy.chen@seasidesuites.com',        phone: '(305) 555-0464', hire_date: '2022-08-25', site_id: siteH2, avatar_key: 'daisy_ss' },
    { first_name: 'Chris',      last_name: 'Park',       role: 'F&B',          role_title: 'Beach Service Attendant',     department: 'Food & Beverage', hourly_rate: 13.5, weekly_hours_max: 36, email: 'chris.park@seasidesuites.com',        phone: '(305) 555-0465', hire_date: '2023-01-20', site_id: siteH2, avatar_key: 'chrisp_ss' },
    { first_name: 'Emma',       last_name: 'Thompson',   role: 'F&B',          role_title: 'Poolside Server',             department: 'Food & Beverage', hourly_rate: 13.5, weekly_hours_max: 35, email: 'emma.thompson@seasidesuites.com',     phone: '(305) 555-0466', hire_date: '2023-05-15', site_id: siteH2, avatar_key: 'emmat_ss' },
    // Spa (6)
    { first_name: 'Crystal',    last_name: 'Park',       role: 'Spa',          role_title: 'Massage Therapist',           department: 'Spa',             hourly_rate: 21.0, weekly_hours_max: 38, email: 'crystal.park@seasidesuites.com',      phone: '(305) 555-0467', hire_date: '2021-03-10', site_id: siteH2, avatar_key: 'crystalp_ss' },
    { first_name: 'Brandon',    last_name: 'Davis',      role: 'Spa',          role_title: 'Massage Therapist',           department: 'Spa',             hourly_rate: 21.0, weekly_hours_max: 38, email: 'brandon.davis@seasidesuites.com',     phone: '(305) 555-0468', hire_date: '2021-09-22', site_id: siteH2, avatar_key: 'brandond_ss' },
    { first_name: 'Grace',      last_name: 'Kim',        role: 'Spa',          role_title: 'Esthetician',                 department: 'Spa',             hourly_rate: 20.0, weekly_hours_max: 38, email: 'grace.kim@seasidesuites.com',         phone: '(305) 555-0469', hire_date: '2022-05-18', site_id: siteH2, avatar_key: 'grace_ss' },
    { first_name: 'Victoria',   last_name: 'Santos',     role: 'Spa',          role_title: 'Nail Technician',             department: 'Spa',             hourly_rate: 18.5, weekly_hours_max: 36, email: 'victoria.santos@seasidesuites.com',   phone: '(305) 555-0470', hire_date: '2022-11-30', site_id: siteH2, avatar_key: 'victorias_ss' },
    { first_name: 'Jason',      last_name: 'Chen',       role: 'Spa',          role_title: 'Fitness Director',            department: 'Spa',             hourly_rate: 20.0, weekly_hours_max: 40, email: 'jason.chen@seasidesuites.com',        phone: '(305) 555-0471', hire_date: '2021-07-14', site_id: siteH2, avatar_key: 'jasonc_ss' },
    { first_name: 'Tiffany',    last_name: 'Brown',      role: 'Spa',          role_title: 'Yoga & Fitness Instructor',   department: 'Spa',             hourly_rate: 18.0, weekly_hours_max: 36, email: 'tiffany.brown@seasidesuites.com',     phone: '(305) 555-0472', hire_date: '2022-09-05', site_id: siteH2, avatar_key: 'tiffany_ss' },
    // Engineering (4)
    { first_name: 'Paul',       last_name: 'Martinez',   role: 'Maintenance',  role_title: 'Senior Maintenance Tech',     department: 'Engineering',     hourly_rate: 21.5, weekly_hours_max: 40, email: 'paul.martinez@seasidesuites.com',     phone: '(305) 555-0473', hire_date: '2020-12-15', site_id: siteH2, avatar_key: 'paulm_ss' },
    { first_name: 'Victor',     last_name: 'Santos',     role: 'Maintenance',  role_title: 'Maintenance Technician',      department: 'Engineering',     hourly_rate: 20.0, weekly_hours_max: 40, email: 'victor.santos@seasidesuites.com',     phone: '(305) 555-0474', hire_date: '2022-03-08', site_id: siteH2, avatar_key: 'victors_ss' },
    { first_name: 'Diana',      last_name: 'Torres',     role: 'Maintenance',  role_title: 'Electrical/HVAC Technician',  department: 'Engineering',     hourly_rate: 21.0, weekly_hours_max: 40, email: 'diana.torres@seasidesuites.com',      phone: '(305) 555-0475', hire_date: '2021-10-25', site_id: siteH2, avatar_key: 'dianat_ss' },
    { first_name: 'James',      last_name: 'Park',       role: 'Maintenance',  role_title: 'Facilities Coordinator',      department: 'Engineering',     hourly_rate: 17.5, weekly_hours_max: 38, email: 'james.park@seasidesuites.com',        phone: '(305) 555-0476', hire_date: '2023-02-18', site_id: siteH2, avatar_key: 'jamesp_ss' },
    // Security (3)
    { first_name: 'Carlos',     last_name: 'Davis',      role: 'Security',     role_title: 'Security Officer',            department: 'Security',        hourly_rate: 18.0, weekly_hours_max: 40, email: 'carlos.davis@seasidesuites.com',      phone: '(305) 555-0477', hire_date: '2021-08-10', site_id: siteH2, avatar_key: 'carlosd_ss' },
    { first_name: 'Maria',      last_name: 'Lopez',      role: 'Security',     role_title: 'Security Officer',            department: 'Security',        hourly_rate: 18.0, weekly_hours_max: 40, email: 'maria.lopez@seasidesuites.com',       phone: '(305) 555-0478', hire_date: '2022-04-22', site_id: siteH2, avatar_key: 'marialopez_ss' },
    { first_name: 'Kevin',      last_name: 'Brown',      role: 'Security',     role_title: 'Security Officer',            department: 'Security',        hourly_rate: 17.0, weekly_hours_max: 38, email: 'kevin.brown@seasidesuites.com',       phone: '(305) 555-0479', hire_date: '2023-06-18', site_id: siteH2, avatar_key: 'kevinb_ss' },
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
      if (emp.id % 5 === 0 && day === 1) continue;
      if (emp.id % 7 === 0 && day === 3) continue;
      insertAvail.run(emp.id, day, startHour, '23:59');
    }
  }

  // ── 4. Forecasts (per site, prior week + current week) ────────────────────
  const thisMonday = currentWeekMonday();
  const lastMonday = addDays(thisMonday, -7);

  const insertForecast = db.prepare(
    'INSERT OR REPLACE INTO forecasts (date, site_id, expected_revenue, expected_covers) VALUES (?, ?, ?, ?)'
  );

  // Revenue by day offset (Mon=0 … Sun=6)
  // Restaurants: higher Fri/Sat
  const restaurantRevByOffset = [2800, 3200, 3800, 4500, 7200, 8500, 5500];
  // Hotels: higher Thu–Sat (business + leisure)
  const hotelRevByOffset      = [32000, 38000, 45000, 55000, 62000, 68000, 44000];

  // Site-specific multipliers
  const siteRevMultiplier: Record<number, number> = {
    [siteR1]: 1.00,   // Bella Napoli — mid-size Chicago restaurant
    [siteR2]: 0.82,   // The Blue Door — smaller Austin restaurant
    [siteH1]: 1.00,   // Grand Pacific — large NY hotel
    [siteH2]: 0.78,   // Seaside Suites — smaller Miami hotel
  };

  const siteIds = [siteR1, siteR2, siteH1, siteH2];

  for (const siteId of siteIds) {
    const isHotel = siteId === siteH1 || siteId === siteH2;
    const revByOffset = isHotel ? hotelRevByOffset : restaurantRevByOffset;
    const multiplier  = siteRevMultiplier[siteId];

    for (let w = 0; w < 2; w++) {
      const weekStart = w === 0 ? lastMonday : thisMonday;
      const weekMult  = w === 0 ? 0.95 : 1.05; // prior week slightly lower, current slightly higher
      for (let d = 0; d < 7; d++) {
        const dateStr = addDays(weekStart, d);
        const revenue = Math.round(revByOffset[d] * multiplier * weekMult);
        // Covers: only meaningful for restaurants (avg check ~$42 BN, ~$38 BD)
        const avgCheck = siteId === siteR1 ? 42 : 38;
        const covers   = isHotel ? 0 : Math.floor(revenue / avgCheck);
        insertForecast.run(dateStr, siteId, revenue, covers);
      }
    }
  }

  // ── 5. Schedules (2 per site) ────────────────────────────────────────────────
  const budgetBySite: Record<number, number> = {
    [siteR1]: 14000, [siteR2]: 11000, [siteH1]: 58000, [siteH2]: 44000,
  };
  const insertSchedule = db.prepare(
    "INSERT INTO schedules (week_start, labor_budget, status, site_id) VALUES (?, ?, ?, ?)"
  );

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

  /** Returns true if this employee works on dayOffset (0=Mon). Gives each person ~2 days off/week. */
  function worksToday(empId: number, dayOffset: number): boolean {
    const off1 = empId % 7;
    const off2 = (empId + 3) % 7;
    return dayOffset !== off1 && dayOffset !== off2;
  }

  // ── 7. Shifts ─────────────────────────────────────────────────────────────

  function seedRestaurantWeek(siteId: number, weekStart: string) {
    const scheduleId = scheduleIds[`${siteId}_${weekStart}`];
    const mgrs    = empsByRole(siteId, 'Manager');
    const servers  = empsByRole(siteId, 'Server');
    const cooks    = empsByRole(siteId, 'Kitchen');
    const barStaff = empsByRole(siteId, 'Bar');
    const hosts    = empsByRole(siteId, 'Host');

    for (let d = 0; d < 7; d++) {
      const date      = addDays(weekStart, d);
      const isWeekend = d === 4 || d === 5; // Fri/Sat offset from Monday

      // Managers
      for (const mgr of mgrs) {
        if (!worksToday(mgr.id, d)) continue;
        insertShift.run(scheduleId, mgr.id, date, '09:00', '17:00', 'Manager');
      }
      // Kitchen: alternating prep / evening
      for (let i = 0; i < cooks.length; i++) {
        const emp = cooks[i];
        if (!worksToday(emp.id, d)) continue;
        if (i % 2 === 0) insertShift.run(scheduleId, emp.id, date, '09:00', '17:00', 'Kitchen');
        else              insertShift.run(scheduleId, emp.id, date, '15:00', '23:00', 'Kitchen');
      }
      // Servers: lunch + dinner halves
      const lunchCap  = isWeekend ? Math.ceil(servers.length * 0.55) : Math.ceil(servers.length * 0.45);
      for (let i = 0; i < servers.length; i++) {
        const emp = servers[i];
        if (!worksToday(emp.id, d)) continue;
        if (i < lunchCap) insertShift.run(scheduleId, emp.id, date, '11:00', '15:00', 'Server');
        else               insertShift.run(scheduleId, emp.id, date, '16:00', '22:00', 'Server');
      }
      // Bar
      for (const emp of barStaff) {
        if (!worksToday(emp.id, d)) continue;
        const barEnd = isWeekend ? '01:00' : '23:30';
        insertShift.run(scheduleId, emp.id, date, '16:00', barEnd, 'Bar');
      }
      // Hosts
      for (const emp of hosts) {
        if (!worksToday(emp.id, d)) continue;
        insertShift.run(scheduleId, emp.id, date, '11:00', '19:00', 'Host');
      }
    }
  }

  function seedHotelWeek(siteId: number, weekStart: string) {
    const scheduleId   = scheduleIds[`${siteId}_${weekStart}`];
    const mgrs         = empsByRole(siteId, 'Manager');
    const frontDeskAll = empsByRole(siteId, 'Front Desk');
    const houseAll     = empsByRole(siteId, 'Housekeeping');
    const kitchenAll   = empsByRole(siteId, 'Kitchen');
    const fbAll        = empsByRole(siteId, 'F&B');
    const barAll       = empsByRole(siteId, 'Bar');
    const maintAll     = empsByRole(siteId, 'Maintenance');
    const secAll       = empsByRole(siteId, 'Security');
    const conciergeAll = empsByRole(siteId, 'Concierge');
    const spaAll       = empsByRole(siteId, 'Spa');

    for (let d = 0; d < 7; d++) {
      const date      = addDays(weekStart, d);
      const isWeekend = d === 5 || d === 6; // Sat/Sun

      // Managers: day shift
      for (const mgr of mgrs) {
        if (!worksToday(mgr.id, d)) continue;
        insertShift.run(scheduleId, mgr.id, date, '08:00', '16:00', 'Manager');
      }
      // Front Desk: 3-shift rotation (day/evening/overnight)
      for (let i = 0; i < frontDeskAll.length; i++) {
        const emp = frontDeskAll[i];
        if (!worksToday(emp.id, d)) continue;
        const t = i % 3;
        if      (t === 0) insertShift.run(scheduleId, emp.id, date, '07:00', '15:00', 'Front Desk');
        else if (t === 1) insertShift.run(scheduleId, emp.id, date, '15:00', '23:00', 'Front Desk');
        else              insertShift.run(scheduleId, emp.id, date, '23:00', '07:00', 'Front Desk');
      }
      // Concierge: day + evening
      for (let i = 0; i < conciergeAll.length; i++) {
        const emp = conciergeAll[i];
        if (!worksToday(emp.id, d)) continue;
        if (i % 2 === 0) insertShift.run(scheduleId, emp.id, date, '07:00', '15:00', 'Concierge');
        else              insertShift.run(scheduleId, emp.id, date, '15:00', '23:00', 'Concierge');
      }
      // Housekeeping: morning (majority) and afternoon
      for (let i = 0; i < houseAll.length; i++) {
        const emp = houseAll[i];
        if (!worksToday(emp.id, d)) continue;
        if (i % 3 < 2) insertShift.run(scheduleId, emp.id, date, '08:00', '16:00', 'Housekeeping');
        else            insertShift.run(scheduleId, emp.id, date, '12:00', '20:00', 'Housekeeping');
      }
      // Kitchen: breakfast and dinner shifts
      for (let i = 0; i < kitchenAll.length; i++) {
        const emp = kitchenAll[i];
        if (!worksToday(emp.id, d)) continue;
        if (i % 2 === 0) insertShift.run(scheduleId, emp.id, date, '06:00', '14:00', 'Kitchen');
        else              insertShift.run(scheduleId, emp.id, date, '14:00', '22:00', 'Kitchen');
      }
      // F&B: meal periods
      for (let i = 0; i < fbAll.length; i++) {
        const emp = fbAll[i];
        if (!worksToday(emp.id, d)) continue;
        const t = i % 3;
        if      (t === 0) insertShift.run(scheduleId, emp.id, date, '07:00', '15:00', 'F&B');
        else if (t === 1) insertShift.run(scheduleId, emp.id, date, '15:00', '23:00', 'F&B');
        else if (isWeekend) insertShift.run(scheduleId, emp.id, date, '11:00', '19:00', 'F&B');
      }
      // Bar: evening/late night
      for (const emp of barAll) {
        if (!worksToday(emp.id, d)) continue;
        const barEnd = isWeekend ? '02:00' : '00:00';
        insertShift.run(scheduleId, emp.id, date, '16:00', barEnd, 'Bar');
      }
      // Maintenance: day shift
      for (const emp of maintAll) {
        if (!worksToday(emp.id, d)) continue;
        insertShift.run(scheduleId, emp.id, date, '08:00', '16:00', 'Maintenance');
      }
      // Security: 3-shift rotation
      for (let i = 0; i < secAll.length; i++) {
        const emp = secAll[i];
        if (!worksToday(emp.id, d)) continue;
        const t = i % 3;
        if      (t === 0) insertShift.run(scheduleId, emp.id, date, '07:00', '15:00', 'Security');
        else if (t === 1) insertShift.run(scheduleId, emp.id, date, '15:00', '23:00', 'Security');
        else              insertShift.run(scheduleId, emp.id, date, '23:00', '07:00', 'Security');
      }
      // Spa: day shifts
      for (const emp of spaAll) {
        if (!worksToday(emp.id, d)) continue;
        if (isWeekend) insertShift.run(scheduleId, emp.id, date, '09:00', '19:00', 'Spa');
        else            insertShift.run(scheduleId, emp.id, date, '10:00', '18:00', 'Spa');
      }
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
    const [ehH, ehM] = (sh.end_time   as string).split(':').map(Number);
    let sMin = shH * 60 + shM;
    let eMin = ehH * 60 + ehM;
    if (eMin < sMin) eMin += 24 * 60;
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
    if (hours < MIN_HOURS_FOR_OVERTIME_RECORD) continue;
    const regularHours  = Math.min(hours, 40);
    const overtimeHours = Math.max(0, hours - 40);
    const overtimePay   = overtimeHours * rate * 1.5;
    insertOT.run(parseInt(empIdStr), lastMonday, regularHours, overtimeHours, overtimePay);
  }

  // ── 9. Users ─────────────────────────────────────────────────────────────
  const insertUser = db.prepare(
    'INSERT OR IGNORE INTO users (username, password_hash, employee_id, is_manager) VALUES (?, ?, ?, ?)'
  );
  const allSeeded = db.prepare('SELECT id, role, first_name FROM employees').all() as any[];
  const usedUsernames = new Set<string>();

  for (const emp of allSeeded) {
    let base     = String(emp.first_name).toLowerCase();
    let username = base;
    let suffix   = 2;
    while (usedUsernames.has(username)) { username = `${base}${suffix}`; suffix++; }
    usedUsernames.add(username);
    const hash      = bcrypt.hashSync('password123', 10);
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
  const r1Curr    = scheduleIds[`${siteR1}_${thisMonday}`];
  const r1Prev    = scheduleIds[`${siteR1}_${lastMonday}`];
  const r1Servers = empsByRole(siteR1, 'Server');
  const r1Cooks   = empsByRole(siteR1, 'Kitchen');
  const r1Bar     = empsByRole(siteR1, 'Bar');

  if (r1Servers.length >= 2) {
    const shift = getShiftFor(r1Curr, r1Servers[0].id);
    if (shift) insertSwap.run(shift.id, r1Servers[0].id, r1Servers[1].id,
      'Family event — can Carol cover my Tuesday lunch?', 'pending', null);
  }
  if (r1Cooks.length >= 2) {
    const shift = getShiftFor(r1Prev, r1Cooks[0].id);
    if (shift) {
      db.prepare("UPDATE shifts SET status='swapped', employee_id=? WHERE id=?").run(r1Cooks[1].id, shift.id);
      insertSwap.run(shift.id, r1Cooks[0].id, r1Cooks[1].id,
        'Doctor appointment in the morning.', 'approved',
        'Approved — Eve confirmed availability. Please log clock-in.');
    }
  }
  if (r1Bar.length > 0) {
    const shift = getShiftFor(r1Curr, r1Bar[0].id);
    if (shift) insertSwap.run(shift.id, r1Bar[0].id, null,
      'Need this Saturday off — personal reasons.', 'rejected',
      'Denied — no available coverage on short notice.');
  }

  // The Blue Door – pending swap
  const r2Curr    = scheduleIds[`${siteR2}_${thisMonday}`];
  const r2Servers = empsByRole(siteR2, 'Server');
  if (r2Servers.length >= 2) {
    const shift = getShiftFor(r2Curr, r2Servers[1].id);
    if (shift) insertSwap.run(shift.id, r2Servers[1].id, r2Servers[0].id,
      'Class schedule conflict on Wednesday.', 'pending', null);
  }

  // Grand Pacific – approved & pending
  const h1Curr  = scheduleIds[`${siteH1}_${thisMonday}`];
  const h1FD    = empsByRole(siteH1, 'Front Desk');
  const h1House = empsByRole(siteH1, 'Housekeeping');
  if (h1FD.length >= 2) {
    const shift = getShiftFor(h1Curr, h1FD[0].id);
    if (shift) {
      db.prepare("UPDATE shifts SET status='swapped', employee_id=? WHERE id=?").run(h1FD[1].id, shift.id);
      insertSwap.run(shift.id, h1FD[0].id, h1FD[1].id,
        'Attending a training seminar all day.', 'approved',
        'Approved — Sam confirmed. Updated roster accordingly.');
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
  if (empCount < 100) throw new Error(`Seed validation: expected ≥ 100 employees, found ${empCount}`);

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
    `✓ Seed validation passed — ${siteCount} sites, ${empCount} employees, ` +
    `all schedules have shifts, all managers have shifts, swap statuses OK`
  );
}
