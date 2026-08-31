export interface ShiftTimeEntry {
  id?: number;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  employee_id?: number | null;
}

export interface RestViolation {
  previousShift: ShiftTimeEntry;
  nextShift: ShiftTimeEntry;
  restHours: number;
  message: string;
}

export interface ShiftOverlapConflict {
  conflictingShift: ShiftTimeEntry;
  message: string;
}

export const MIN_REST_HOURS = 11;

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converts a shift into absolute UTC millisecond start and end points.
 */
export function getShiftIntervalMs(shift: ShiftTimeEntry): { startMs: number; endMs: number } {
  const [y, m, d] = shift.date.split('-').map(Number);
  const startMin = parseTimeToMinutes(shift.start_time);
  let endMin = parseTimeToMinutes(shift.end_time);
  const overnight = endMin <= startMin;

  const startDate = new Date(Date.UTC(y, m - 1, d, Math.floor(startMin / 60), startMin % 60));
  const endDate = new Date(Date.UTC(y, m - 1, d + (overnight ? 1 : 0), Math.floor(endMin % (24 * 60) / 60), endMin % 60));

  return {
    startMs: startDate.getTime(),
    endMs: endDate.getTime(),
  };
}

/**
 * Checks if a proposed shift overlaps in time with any existing shift for the same employee.
 * Two intervals [startA, endA) and [startB, endB) overlap if startA < endB and endA > startB.
 */
export function checkShiftOverlap(
  proposedShift: ShiftTimeEntry,
  existingShifts: ShiftTimeEntry[],
  excludeShiftId?: number
): ShiftOverlapConflict | null {
  const proposed = getShiftIntervalMs(proposedShift);

  const filtered = existingShifts.filter((s) => {
    if (excludeShiftId && s.id === excludeShiftId) return false;
    return Boolean(s.date && s.start_time && s.end_time);
  });

  for (const existing of filtered) {
    const ex = getShiftIntervalMs(existing);
    // Overlap condition: start of one is before end of other, and end of one is after start of other
    if (proposed.startMs < ex.endMs && proposed.endMs > ex.startMs) {
      return {
        conflictingShift: existing,
        message: `Shift conflict: Employee is already scheduled for an overlapping shift on ${existing.date} (${existing.start_time}-${existing.end_time}).`,
      };
    }
  }

  return null;
}

/**
 * Calculates rest hours between shiftA and shiftB.
 * Returns null if shiftA does not precede shiftB chronologically.
 */
export function calculateRestHours(
  shiftA: ShiftTimeEntry,
  shiftB: ShiftTimeEntry
): number {
  const [y1, m1, d1] = shiftA.date.split('-').map(Number);
  const [y2, m2, d2] = shiftB.date.split('-').map(Number);

  const startA = parseTimeToMinutes(shiftA.start_time);
  let endA = parseTimeToMinutes(shiftA.end_time);
  const overnightA = endA <= startA;

  // Compute end timestamp for shiftA (in UTC ms)
  const endDateA = new Date(Date.UTC(y1, m1 - 1, d1 + (overnightA ? 1 : 0), Math.floor(endA % (24 * 60) / 60), endA % 60));

  // Compute start timestamp for shiftB (in UTC ms)
  const startB = parseTimeToMinutes(shiftB.start_time);
  const startDateB = new Date(Date.UTC(y2, m2 - 1, d2, Math.floor(startB / 60), startB % 60));

  const diffMs = startDateB.getTime() - endDateA.getTime();
  return diffMs / (1000 * 60 * 60);
}

/**
 * Checks a proposed shift for an employee against their existing shifts in the schedule.
 * Returns a RestViolation if rest window < minRestHours (default 11h), or null if clean.
 */
export function checkRestViolation(
  proposedShift: ShiftTimeEntry,
  existingShifts: ShiftTimeEntry[],
  minRestHours: number = MIN_REST_HOURS,
  excludeShiftId?: number
): RestViolation | null {
  const filtered = existingShifts.filter((s) => {
    if (excludeShiftId && s.id === excludeShiftId) return false;
    return Boolean(s.date && s.start_time && s.end_time);
  });

  for (const existing of filtered) {
    // Check if proposed is followed by existing
    const restAfter = calculateRestHours(proposedShift, existing);
    if (restAfter >= 0 && restAfter < minRestHours) {
      return {
        previousShift: proposedShift,
        nextShift: existing,
        restHours: Math.round(restAfter * 10) / 10,
        message: `Rest window violation: Proposed shift (${proposedShift.date} ${proposedShift.start_time}-${proposedShift.end_time}) leaves only ${restAfter.toFixed(1)}h rest before next shift on ${existing.date} at ${existing.start_time} (minimum ${minRestHours}h required).`,
      };
    }

    // Check if existing is followed by proposed
    const restBefore = calculateRestHours(existing, proposedShift);
    if (restBefore >= 0 && restBefore < minRestHours) {
      return {
        previousShift: existing,
        nextShift: proposedShift,
        restHours: Math.round(restBefore * 10) / 10,
        message: `Rest window violation: Preceding shift (${existing.date} ${existing.start_time}-${existing.end_time}) leaves only ${restBefore.toFixed(1)}h rest before proposed shift on ${proposedShift.date} at ${proposedShift.start_time} (minimum ${minRestHours}h required).`,
      };
    }
  }

  return null;
}
