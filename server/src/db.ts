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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      hourly_rate REAL NOT NULL DEFAULT 15.0,
      weekly_hours_max INTEGER NOT NULL DEFAULT 40,
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
      date TEXT NOT NULL UNIQUE,    -- YYYY-MM-DD
      expected_revenue REAL NOT NULL,
      expected_covers INTEGER NOT NULL DEFAULT 0
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
}

export function closeDb(): void {
  if (db) {
    db.close();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db = undefined as any;
  }
}