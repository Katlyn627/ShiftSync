import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();
const DEFAULT_HOURLY_RATE = 15.0;
const DEFAULT_WEEKLY_HOURS_MAX = 40;

type ParsedEmployeeRow = {
  name: string;
  role: string;
  hourly_rate?: number;
  weekly_hours_max?: number;
  email?: string;
  phone?: string;
};

type ImportedEmployee = {
  id: number;
  name: string;
  role: string;
  hourly_rate: number;
  weekly_hours_max: number;
  email: string;
  phone: string;
  pay_type: string;
  certifications: string;
  is_minor: number;
  union_member: number;
  site_id: number | null;
};

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitRows(input: string): string[] {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function detectDelimiter(headerLine: string): ',' | '\t' | ';' {
  if (headerLine.includes('\t')) return '\t';
  if (headerLine.includes(';')) return ';';
  return ',';
}

function parseDelimitedLine(line: string, delimiter: ',' | '\t' | ';'): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i += 1;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  out.push(current.trim());
  return out;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapSpreadsheetRows(rawText: string): ParsedEmployeeRow[] {
  const rows = splitRows(rawText);
  if (rows.length < 2) return [];

  const delimiter = detectDelimiter(rows[0]);
  const headers = parseDelimitedLine(rows[0], delimiter).map(normalizeHeader);
  const out: ParsedEmployeeRow[] = [];

  for (const rowLine of rows.slice(1)) {
    const cols = parseDelimitedLine(rowLine, delimiter);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = (cols[idx] ?? '').trim();
    });

    const name = rowObj.name || [rowObj.firstname, rowObj.lastname].filter(Boolean).join(' ').trim();
    const role = rowObj.role || rowObj.roletitle || rowObj.position || rowObj.jobtitle;
    if (!name || !role) continue;

    const hourlyRateRaw = rowObj.hourlyrate || rowObj.hourly || rowObj.rate || rowObj.payrate;
    const weeklyHoursRaw = rowObj.weeklyhoursmax || rowObj.maxhours || rowObj.weeklyhours;
    const hourly_rate = parseOptionalNumber(hourlyRateRaw);
    const weekly_hours_max = parseOptionalNumber(weeklyHoursRaw);

    out.push({
      name,
      role,
      hourly_rate,
      weekly_hours_max,
      email: rowObj.email || undefined,
      phone: rowObj.phone || rowObj.phonenumber || undefined,
    });
  }

  return out;
}

function mapJsonRows(parsed: unknown): ParsedEmployeeRow[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((row: any) => {
      const name = typeof row?.name === 'string'
        ? row.name.trim()
        : [row?.first_name, row?.last_name].filter((v: unknown) => typeof v === 'string' && v.trim()).join(' ').trim();
      const role = [row?.role, row?.role_title, row?.position, row?.job_title]
        .find((v: unknown) => typeof v === 'string' && v.trim()) as string | undefined;
      if (!name || !role) return null;
      const hourlyRateCandidate = row?.hourly_rate ?? row?.hourlyRate ?? row?.rate;
      const maxHoursCandidate = row?.weekly_hours_max ?? row?.weeklyHoursMax ?? row?.max_hours;
      const hourly_rate = parseOptionalNumber(hourlyRateCandidate);
      const weekly_hours_max = parseOptionalNumber(maxHoursCandidate);
      return {
        name,
        role,
        hourly_rate,
        weekly_hours_max,
        email: typeof row?.email === 'string' ? row.email : undefined,
        phone: typeof row?.phone === 'string' ? row.phone : undefined,
      } as ParsedEmployeeRow;
    })
    .filter((row): row is ParsedEmployeeRow => row !== null);
}

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId;
  const employees = siteId
    ? db.prepare('SELECT * FROM employees WHERE site_id = ? ORDER BY name').all(siteId)
    : db.prepare('SELECT * FROM employees ORDER BY name').all();
  res.json(employees);
});

router.post('/', requireManager, (req: Request, res: Response) => {
  const { name, role, hourly_rate, weekly_hours_max, email, phone, pay_type, certifications, is_minor, union_member } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const result = db.prepare(
    'INSERT INTO employees (name, role, hourly_rate, weekly_hours_max, email, phone, pay_type, certifications, is_minor, union_member, site_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    name,
    role,
    hourly_rate ?? DEFAULT_HOURLY_RATE,
    weekly_hours_max ?? DEFAULT_WEEKLY_HOURS_MAX,
    email ?? '',
    phone ?? '',
    pay_type ?? 'hourly',
    certifications ? JSON.stringify(certifications) : '[]',
    is_minor ? 1 : 0,
    union_member ? 1 : 0,
    siteId
  );
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(employee);
});

router.post('/import', requireManager, (req: Request, res: Response) => {
  const { data, format } = req.body ?? {};
  if (typeof data !== 'string' || !data.trim()) {
    return res.status(400).json({ error: 'data is required' });
  }

  let parsedRows: ParsedEmployeeRow[] = [];

  try {
    const desiredFormat = typeof format === 'string' ? format.toLowerCase() : 'auto';
    if (desiredFormat === 'json') {
      parsedRows = mapJsonRows(JSON.parse(data));
    } else if (desiredFormat === 'csv' || desiredFormat === 'tsv' || desiredFormat === 'auto') {
      if (desiredFormat === 'auto') {
        try {
          parsedRows = mapJsonRows(JSON.parse(data));
        } catch (_) {
          parsedRows = mapSpreadsheetRows(data);
        }
      } else {
        parsedRows = mapSpreadsheetRows(data);
      }
    } else {
      return res.status(400).json({ error: 'format must be auto, csv, tsv, or json' });
    }
  } catch (error: any) {
    const details = error?.message ? `: ${error.message}` : '';
    return res.status(400).json({ error: `Unable to parse import data${details}` });
  }

  if (parsedRows.length === 0) {
    return res.status(400).json({ error: 'No valid employee rows found. Include at least name and role columns.' });
  }

  const db = getDb();
  const siteId = req.user?.siteId ?? null;
  const insertStmt = db.prepare(
    'INSERT INTO employees (name, role, hourly_rate, weekly_hours_max, email, phone, pay_type, certifications, is_minor, union_member, site_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const getByIdStmt = db.prepare('SELECT * FROM employees WHERE id = ?');

  const created: ImportedEmployee[] = [];
  const insertMany = db.transaction((rows: ParsedEmployeeRow[]) => {
    for (const row of rows) {
      const result = insertStmt.run(
        row.name,
        row.role,
        row.hourly_rate ?? DEFAULT_HOURLY_RATE,
        row.weekly_hours_max ?? DEFAULT_WEEKLY_HOURS_MAX,
        row.email ?? '',
        row.phone ?? '',
        'hourly',
        '[]',
        0,
        0,
        siteId
      );
      created.push(getByIdStmt.get(result.lastInsertRowid) as ImportedEmployee);
    }
  });

  insertMany(parsedRows);
  return res.status(201).json({
    imported: created.length,
    employees: created,
  });
});

// Allow managers to update any employee; allow employees to update their own profile fields
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Employee not found' });

  const isManager = req.user?.isManager;
  const isSelf = req.user?.employeeId === parseInt(req.params.id);

  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'You can only update your own profile' });
  }

  const { name, role, hourly_rate, weekly_hours_max, email, phone, photo_url, pay_type, certifications, is_minor, union_member, location_lat, location_lng, location_label } = req.body;

  if (isManager) {
    // Managers can update everything
    db.prepare(
      'UPDATE employees SET name=?, role=?, hourly_rate=?, weekly_hours_max=?, email=?, phone=?, photo_url=?, pay_type=?, certifications=?, is_minor=?, union_member=?, location_lat=?, location_lng=?, location_label=? WHERE id=?'
    ).run(
      name ?? existing.name,
      role ?? existing.role,
      hourly_rate ?? existing.hourly_rate,
      weekly_hours_max ?? existing.weekly_hours_max,
      email !== undefined ? email : (existing.email ?? ''),
      phone !== undefined ? phone : (existing.phone ?? ''),
      photo_url !== undefined ? photo_url : (existing.photo_url ?? null),
      pay_type ?? existing.pay_type ?? 'hourly',
      certifications !== undefined ? JSON.stringify(certifications) : (existing.certifications ?? '[]'),
      is_minor !== undefined ? (is_minor ? 1 : 0) : (existing.is_minor ?? 0),
      union_member !== undefined ? (union_member ? 1 : 0) : (existing.union_member ?? 0),
      location_lat !== undefined ? location_lat : (existing.location_lat ?? null),
      location_lng !== undefined ? location_lng : (existing.location_lng ?? null),
      location_label !== undefined ? location_label : (existing.location_label ?? null),
      req.params.id
    );
  } else {
    // Employees can only update their own contact info, availability preferences, photo, and location
    db.prepare(
      'UPDATE employees SET weekly_hours_max=?, email=?, phone=?, photo_url=?, location_lat=?, location_lng=?, location_label=? WHERE id=?'
    ).run(
      weekly_hours_max ?? existing.weekly_hours_max,
      email !== undefined ? email : (existing.email ?? ''),
      phone !== undefined ? phone : (existing.phone ?? ''),
      photo_url !== undefined ? photo_url : (existing.photo_url ?? null),
      location_lat !== undefined ? location_lat : (existing.location_lat ?? null),
      location_lng !== undefined ? location_lng : (existing.location_lng ?? null),
      location_label !== undefined ? location_label : (existing.location_label ?? null),
      req.params.id
    );
  }

  const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json({ success: true });
});

// Bulk availability — returns all employees' availability for the site in one query
router.get('/availability', requireManager, (req: Request, res: Response) => {
  const db = getDb();
  const siteId = req.user?.siteId;
  if (!siteId) return res.json([]);
  const rows = db.prepare(
    'SELECT a.* FROM availability a JOIN employees e ON e.id = a.employee_id WHERE e.site_id = ? ORDER BY a.employee_id, a.day_of_week'
  ).all(siteId);
  res.json(rows);
});

// Availability
router.get('/:id/availability', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const availability = db.prepare('SELECT * FROM availability WHERE employee_id = ? ORDER BY day_of_week').all(req.params.id);
  res.json(availability);
});

router.post('/:id/availability', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = parseInt(req.params.id);
  const isManager = req.user?.isManager;
  const isSelf = req.user?.employeeId === employeeId;
  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'You can only update your own availability' });
  }

  const { day_of_week, start_time, end_time, availability_type } = req.body;
  if (day_of_week === undefined) {
    return res.status(400).json({ error: 'day_of_week is required' });
  }

  const type = availability_type ?? 'specific';

  // For 'open', store full-day times; for 'unavailable', store sentinel times;
  // for 'specific', require explicit start/end times.
  let resolvedStart = start_time;
  let resolvedEnd = end_time;
  if (type === 'open') {
    resolvedStart = '00:00';
    resolvedEnd = '23:59';
  } else if (type === 'unavailable') {
    resolvedStart = '00:00';
    resolvedEnd = '00:00';
  } else {
    if (!start_time || !end_time) {
      return res.status(400).json({ error: 'start_time and end_time are required for specific availability' });
    }
  }

  db.prepare(
    'INSERT OR REPLACE INTO availability (employee_id, day_of_week, start_time, end_time, availability_type) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, day_of_week, resolvedStart, resolvedEnd, type);
  const avail = db.prepare('SELECT * FROM availability WHERE employee_id = ? AND day_of_week = ?').get(req.params.id, day_of_week);
  res.status(201).json(avail);
});

router.delete('/:id/availability/:day', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const employeeId = parseInt(req.params.id);
  const isManager = req.user?.isManager;
  const isSelf = req.user?.employeeId === employeeId;
  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'You can only update your own availability' });
  }
  const result = db.prepare(
    'DELETE FROM availability WHERE employee_id = ? AND day_of_week = ?'
  ).run(employeeId, req.params.day);
  if (result.changes === 0) return res.status(404).json({ error: 'Availability entry not found' });
  res.json({ success: true });
});

export default router;
