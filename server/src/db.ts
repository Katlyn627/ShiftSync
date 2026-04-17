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

    CREATE TABLE IF NOT EXISTS open_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      source_shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
      source_swap_id INTEGER,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      role TEXT NOT NULL,
      required_certifications TEXT NOT NULL DEFAULT '[]',
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'open', -- open | claimed | cancelled | expired
      deadline TEXT,
      claimed_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS open_shift_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      open_shift_id INTEGER NOT NULL REFERENCES open_shifts(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | withdrawn | ineligible
      ineligibility_reason TEXT,
      manager_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(open_shift_id, employee_id)
    );

    CREATE TABLE IF NOT EXISTS shift_swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      requester_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      target_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      manager_notes TEXT,
      open_shift_id INTEGER REFERENCES open_shifts(id) ON DELETE SET NULL,
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

    CREATE TABLE IF NOT EXISTS site_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(site_id, name)
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
  if (!empCols.some(c => c.name === 'location_lat')) {
    db.exec("ALTER TABLE employees ADD COLUMN location_lat REAL DEFAULT NULL");
  }
  if (!empCols.some(c => c.name === 'location_lng')) {
    db.exec("ALTER TABLE employees ADD COLUMN location_lng REAL DEFAULT NULL");
  }
  if (!empCols.some(c => c.name === 'location_label')) {
    db.exec("ALTER TABLE employees ADD COLUMN location_label TEXT DEFAULT NULL");
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

  const swapCols = db.pragma('table_info(shift_swaps)') as { name: string }[];
  if (swapCols.length > 0 && !swapCols.some(c => c.name === 'open_shift_id')) {
    db.exec('ALTER TABLE shift_swaps ADD COLUMN open_shift_id INTEGER REFERENCES open_shifts(id) ON DELETE SET NULL');
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

}

export function closeDb(): void {
  if (db) {
    db.close();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db = undefined as any;
  }
}
