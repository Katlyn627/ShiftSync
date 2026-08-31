import { getDb } from '../db';
import { checkRestViolation, checkShiftOverlap, parseTimeToMinutes } from './restWindow';

export interface OpenShiftRecord {
  id: number;
  schedule_id: number;
  site_id?: number | null;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  required_certifications?: string | null;
  status: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/**
 * Evaluates whether an employee is eligible to claim/offer for a specific open shift.
 * Checks:
 * 1. Role match (exact role match or Manager)
 * 2. Required certifications
 * 3. Weekly hours cap
 * 4. Shift overlap / double-booking
 * 5. Minimum rest window (11 hours turnaround)
 */
export function evaluateOpenShiftEligibility(
  employeeId: number,
  openShift: OpenShiftRecord
): EligibilityResult {
  const db = getDb();
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as any;
  if (!employee) {
    return {
      eligible: false,
      reasons: ['Employee record not found'],
    };
  }

  const reasons: string[] = [];

  // 1. Role match
  const shiftRole = openShift.role.trim().toLowerCase();
  const empRole = (employee.role || '').trim().toLowerCase();
  if (empRole !== shiftRole && empRole !== 'manager') {
    reasons.push(`Role mismatch: shift requires "${openShift.role}", your role is "${employee.role}"`);
  }

  // 2. Required certifications
  let requiredCerts: string[] = [];
  try {
    if (openShift.required_certifications) {
      requiredCerts = JSON.parse(openShift.required_certifications);
    }
  } catch (_) {
    requiredCerts = [];
  }

  let empCerts: string[] = [];
  try {
    if (employee.certifications) {
      empCerts = JSON.parse(employee.certifications);
    }
  } catch (_) {
    empCerts = [];
  }

  const empCertSet = new Set(empCerts.map((c) => c.trim().toLowerCase()));
  const missingCerts = requiredCerts.filter((c) => !empCertSet.has(c.trim().toLowerCase()));
  if (missingCerts.length > 0) {
    reasons.push(`Missing required certification(s): ${missingCerts.join(', ')}`);
  }

  // 3. Weekly hours cap
  const shiftStartMin = parseTimeToMinutes(openShift.start_time);
  let shiftEndMin = parseTimeToMinutes(openShift.end_time);
  if (shiftEndMin <= shiftStartMin) shiftEndMin += 24 * 60;
  const shiftDurationHours = (shiftEndMin - shiftStartMin) / 60;

  const existingShifts = db.prepare(
    "SELECT id, date, start_time, end_time FROM shifts WHERE schedule_id = ? AND employee_id = ? AND status != 'cancelled'"
  ).all(openShift.schedule_id, employeeId) as any[];

  const currentWeeklyHours = existingShifts.reduce((sum, s) => {
    const sStart = parseTimeToMinutes(s.start_time);
    let sEnd = parseTimeToMinutes(s.end_time);
    if (sEnd <= sStart) sEnd += 24 * 60;
    return sum + (sEnd - sStart) / 60;
  }, 0);

  const weeklyCap = employee.weekly_hours_max || 40;
  if (currentWeeklyHours + shiftDurationHours > weeklyCap) {
    reasons.push(
      `Exceeds max weekly hours limit: ${weeklyCap}h (currently scheduled ${currentWeeklyHours.toFixed(1)}h + ${shiftDurationHours.toFixed(1)}h shift)`
    );
  }

  // 4. Shift overlap / double-booking
  const proposedShiftTime = {
    date: openShift.date,
    start_time: openShift.start_time,
    end_time: openShift.end_time,
  };
  const overlap = checkShiftOverlap(proposedShiftTime, existingShifts);
  if (overlap) {
    reasons.push(`Time conflict: Already scheduled for an overlapping shift on ${openShift.date}`);
  }

  // 5. Rest window (< 11 hours turnaround)
  const restViolation = checkRestViolation(proposedShiftTime, existingShifts, 11);
  if (restViolation) {
    reasons.push(`Rest window violation: Turnaround has only ${restViolation.restHours}h rest (< 11h required)`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
