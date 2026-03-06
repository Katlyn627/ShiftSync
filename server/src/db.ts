import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'shiftsync.db');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Chicago',
      site_type TEXT NOT NULL DEFAULT 'restaurant', -- restaurant | hotel
      jurisdiction TEXT NOT NULL DEFAULT 'default',  -- compliance rule set: default | eu | us-ca | …
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      pay_type TEXT NOT NULL DEFAULT 'hourly',         -- hourly | salaried
      hourly_rate REAL NOT NULL DEFAULT 15.0,
      weekly_hours_max INTEGER NOT NULL DEFAULT 40,
      certifications TEXT NOT NULL DEFAULT '[]',       -- JSON array of skill/cert labels
      is_minor INTEGER NOT NULL DEFAULT 0,             -- 0=no, 1=yes
      union_member INTEGER NOT NULL DEFAULT 0,         -- 0=no, 1=yes
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compliance_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jurisdiction TEXT NOT NULL,
      rule_type TEXT NOT NULL,   -- min_rest_hours | max_consecutive_days | max_weekly_hours |
                                 -- overtime_threshold_daily | advance_notice_days |
                                 -- predictability_pay_hours | minor_max_daily_hours |
                                 -- minor_max_weekly_hours
      rule_value TEXT NOT NULL,  -- numeric value stored as text for flexibility
      description TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(jurisdiction, rule_type)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,         -- shift_assigned | swap_approved | time_off_rejected | schedule_published | …
      entity_type TEXT NOT NULL,    -- shift | swap | time_off | schedule | employee
      entity_id INTEGER,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      details TEXT NOT NULL DEFAULT '{}',   -- JSON supplementary data
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scheduling_appeals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      manager_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_overtime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL,
      regular_hours REAL NOT NULL DEFAULT 0.0,
      overtime_hours REAL NOT NULL DEFAULT 0.0,
      overtime_pay REAL NOT NULL DEFAULT 0.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(employee_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL, -- 0=Sun, 1=Mon, ..., 6=Sat
      start_time TEXT NOT NULL,     -- HH:MM
      end_time TEXT NOT NULL,       -- HH:MM
      availability_type TEXT NOT NULL DEFAULT 'specific', -- specific | open | unavailable
      UNIQUE(employee_id, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,           -- YYYY-MM-DD
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      expected_revenue REAL NOT NULL,
      expected_covers INTEGER NOT NULL DEFAULT 0,
      UNIQUE(date, site_id)
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,     -- YYYY-MM-DD (Monday)
      labor_budget REAL NOT NULL DEFAULT 5000.0,
      status TEXT NOT NULL DEFAULT 'draft', -- draft | published
      site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,           -- YYYY-MM-DD
      start_time TEXT NOT NULL,     -- HH:MM
      end_time TEXT NOT NULL,       -- HH:MM
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | swapped | cancelled
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shift_swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      requester_id INTEGER NOT NULL REFERENCES employees(id),
      target_id INTEGER REFERENCES employees(id),
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      manager_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      is_manager INTEGER NOT NULL DEFAULT 0, -- 0=employee, 1=manager
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS time_off_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,   -- YYYY-MM-DD
      end_date TEXT NOT NULL,     -- YYYY-MM-DD
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      manager_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restaurant_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row
      seats INTEGER NOT NULL DEFAULT 60,
      tables INTEGER NOT NULL DEFAULT 15,
      cogs_pct REAL NOT NULL DEFAULT 30.0,
      target_labor_pct REAL NOT NULL DEFAULT 30.0,
      operating_hours_per_day REAL NOT NULL DEFAULT 12.0
    );

    CREATE TABLE IF NOT EXISTS standby_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,           -- YYYY-MM-DD
      role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(schedule_id, employee_id, date)
    );
  `);

  // Migrate existing databases: add google_id column if absent
  const cols = db.pragma('table_info(users)') as { name: string }[];
  if (!cols.some(c => c.name === 'google_id')) {
    db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
  }

  // Migrate employees table: add email, phone, and photo_url columns if absent
  const empCols = db.pragma('table_info(employees)') as { name: string }[];
  if (!empCols.some(c => c.name === 'email')) {
    db.exec("ALTER TABLE employees ADD COLUMN email TEXT DEFAULT ''");
  }
  if (!empCols.some(c => c.name === 'phone')) {
    db.exec("ALTER TABLE employees ADD COLUMN phone TEXT DEFAULT ''");
  }
  if (!empCols.some(c => c.name === 'photo_url')) {
    db.exec("ALTER TABLE employees ADD COLUMN photo_url TEXT DEFAULT NULL");
  }
  if (!empCols.some(c => c.name === 'first_name')) {
    db.exec("ALTER TABLE employees ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
  }
  if (!empCols.some(c => c.name === 'last_name')) {
    db.exec("ALTER TABLE employees ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
  }
  if (!empCols.some(c => c.name === 'department')) {
    db.exec("ALTER TABLE employees ADD COLUMN department TEXT NOT NULL DEFAULT ''");
  }
  if (!empCols.some(c => c.name === 'role_title')) {
    db.exec("ALTER TABLE employees ADD COLUMN role_title TEXT NOT NULL DEFAULT ''");
  }
  if (!empCols.some(c => c.name === 'hire_date')) {
    db.exec("ALTER TABLE employees ADD COLUMN hire_date TEXT NOT NULL DEFAULT ''");
  }
  if (!empCols.some(c => c.name === 'site_id')) {
    db.exec("ALTER TABLE employees ADD COLUMN site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL");
  }
  // New capability columns
  if (!empCols.some(c => c.name === 'pay_type')) {
    db.exec("ALTER TABLE employees ADD COLUMN pay_type TEXT NOT NULL DEFAULT 'hourly'");
  }
  if (!empCols.some(c => c.name === 'certifications')) {
    db.exec("ALTER TABLE employees ADD COLUMN certifications TEXT NOT NULL DEFAULT '[]'");
  }
  if (!empCols.some(c => c.name === 'is_minor')) {
    db.exec("ALTER TABLE employees ADD COLUMN is_minor INTEGER NOT NULL DEFAULT 0");
  }
  if (!empCols.some(c => c.name === 'union_member')) {
    db.exec("ALTER TABLE employees ADD COLUMN union_member INTEGER NOT NULL DEFAULT 0");
  }

  // Migrate sites table: add jurisdiction column if absent
  const siteCols = db.pragma('table_info(sites)') as { name: string }[];
  if (!siteCols.some(c => c.name === 'jurisdiction')) {
    db.exec("ALTER TABLE sites ADD COLUMN jurisdiction TEXT NOT NULL DEFAULT 'default'");
  }

  // Migrate availability table: add availability_type column if absent
  const availCols = db.pragma('table_info(availability)') as { name: string }[];
  if (!availCols.some(c => c.name === 'availability_type')) {
    db.exec("ALTER TABLE availability ADD COLUMN availability_type TEXT NOT NULL DEFAULT 'specific'");
  }

  // Migrate schedules table: add site_id column if absent
  const scheduleCols = db.pragma('table_info(schedules)') as { name: string }[];
  if (!scheduleCols.some(c => c.name === 'site_id')) {
    db.exec("ALTER TABLE schedules ADD COLUMN site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL");
  }

  // Migrate forecasts table: replace UNIQUE(date) with UNIQUE(date, site_id) for per-site revenue
  const forecastCols = db.pragma('table_info(forecasts)') as { name: string }[];
  if (!forecastCols.some(c => c.name === 'site_id')) {
    db.exec(`
      ALTER TABLE forecasts RENAME TO _forecasts_old;
      CREATE TABLE forecasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
        expected_revenue REAL NOT NULL,
        expected_covers INTEGER NOT NULL DEFAULT 0,
        UNIQUE(date, site_id)
      );
      INSERT INTO forecasts (id, date, expected_revenue, expected_covers)
        SELECT id, date, expected_revenue, expected_covers FROM _forecasts_old;
      DROP TABLE _forecasts_old;
    `);
  }

  // Seed default compliance rules (idempotent via INSERT OR IGNORE)
  seedDefaultComplianceRules(db);
}

/**
 * Insert a curated set of compliance rules covering the most common jurisdictions.
 * Uses INSERT OR IGNORE so existing customisations are never overwritten.
 */
function seedDefaultComplianceRules(db: Database.Database): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO compliance_rules (jurisdiction, rule_type, rule_value, description)
    VALUES (?, ?, ?, ?)
  `);

  const rules: [string, string, string, string][] = [
    // ── Default (US baseline) ────────────────────────────────────────────────
    ['default', 'min_rest_hours',          '10',  'Minimum hours between end of one shift and start of next (clopen threshold)'],
    ['default', 'max_consecutive_days',    '6',   'Maximum consecutive working days before a mandatory day off'],
    ['default', 'max_weekly_hours',        '40',  'Standard weekly hours before overtime applies'],
    ['default', 'overtime_threshold_daily','8',   'Daily hours threshold triggering daily overtime (0 = disabled)'],
    ['default', 'advance_notice_days',     '0',   'Advance notice days required before schedule changes (0 = no requirement)'],
    ['default', 'predictability_pay_hours','0',   'Hours of pay owed if schedule changes within notice window (0 = disabled)'],
    ['default', 'minor_max_daily_hours',   '8',   'Maximum daily hours for minor (under-18) workers'],
    ['default', 'minor_max_weekly_hours',  '40',  'Maximum weekly hours for minor (under-18) workers'],

    // ── EU Working Time Directive ────────────────────────────────────────────
    ['eu', 'min_rest_hours',          '11',  'EU WTD Art.3: 11 consecutive hours minimum daily rest'],
    ['eu', 'max_consecutive_days',    '6',   'EU WTD Art.5: at least one rest day per week'],
    ['eu', 'max_weekly_hours',        '48',  'EU WTD Art.6: 48 h/week averaged over reference period (opt-out possible)'],
    ['eu', 'overtime_threshold_daily','0',   'EU does not mandate daily OT premium (national law may vary)'],
    ['eu', 'advance_notice_days',     '0',   'EU WTD does not specify a fixed notice window'],
    ['eu', 'predictability_pay_hours','0',   'Not mandated at EU level'],
    ['eu', 'minor_max_daily_hours',   '8',   'EU Young Workers Directive: max 8 h/day for under-18'],
    ['eu', 'minor_max_weekly_hours',  '40',  'EU Young Workers Directive: max 40 h/week for under-18'],

    // ── US California ────────────────────────────────────────────────────────
    ['us-ca', 'min_rest_hours',          '8',   'California IWC: minimum 8-hour rest between shifts recommended'],
    ['us-ca', 'max_consecutive_days',    '6',   'CA Lab. Code §551–552: one day rest in seven'],
    ['us-ca', 'max_weekly_hours',        '40',  'CA Lab. Code §510: OT after 40 h/week'],
    ['us-ca', 'overtime_threshold_daily','8',   'CA Lab. Code §510: OT after 8 h/day, double-time after 12 h/day'],
    ['us-ca', 'advance_notice_days',     '0',   'No uniform statewide predictive scheduling law in CA (check local ordinances: San Francisco, Berkeley, Emeryville have their own)'],
    ['us-ca', 'predictability_pay_hours','0',   'Varies by locality — check SF/Berkeley/Emeryville ordinances for predictability pay requirements'],
    ['us-ca', 'minor_max_daily_hours',   '8',   'CA minor work permit limit'],
    ['us-ca', 'minor_max_weekly_hours',  '48',  'CA minor work permit limit (with permit, up to 48 h/week for 16-17 yr)'],

    // ── US NYC (Fair Workweek) ───────────────────────────────────────────────
    ['us-nyc', 'min_rest_hours',          '11',  'NYC Fair Workweek: 11-hour rest between closing and opening shifts'],
    ['us-nyc', 'max_consecutive_days',    '6',   'Standard federal guideline'],
    ['us-nyc', 'max_weekly_hours',        '40',  'FLSA standard'],
    ['us-nyc', 'overtime_threshold_daily','0',   'NY does not require daily OT'],
    ['us-nyc', 'advance_notice_days',     '14',  'NYC Fair Workweek Law: 14-day advance schedule notice for fast food & retail'],
    ['us-nyc', 'predictability_pay_hours','1',   'NYC Fair Workweek: 1-hour premium pay if schedule changed with <14 days notice'],
    ['us-nyc', 'minor_max_daily_hours',   '8',   'NY Education Law minor restrictions'],
    ['us-nyc', 'minor_max_weekly_hours',  '40',  'NY Education Law minor restrictions'],
  ];

  const insertMany = db.transaction(() => {
    for (const [j, rt, rv, desc] of rules) {
      insert.run(j, rt, rv, desc);
    }
  });
  insertMany();
}

export function closeDb(): void {
  if (db) {
    db.close();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db = undefined as any;
  }
}