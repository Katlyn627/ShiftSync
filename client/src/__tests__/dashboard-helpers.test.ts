import { describe, it, expect } from 'vitest';

// Mirror the helper functions from Dashboard.tsx for unit testing
function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftHours(start: string, end: string): number {
  const startMin = parseMinutes(start);
  let endMin = parseMinutes(end);
  if (endMin < startMin) endMin += 24 * 60;
  return (endMin - startMin) / 60;
}

function calculateEmployeeLaborCost(shifts: { start_time: string; end_time: string; hourly_rate: number | null | undefined }[]): number {
  return shifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time) * (s.hourly_rate ?? 0), 0);
}

function calculateTotalHours(shifts: { start_time: string; end_time: string }[]): number {
  return shifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0);
}

describe('Dashboard numeric helpers', () => {
  describe('shiftHours', () => {
    it('calculates standard shift duration', () => {
      expect(shiftHours('09:00', '17:00')).toBe(8);
    });

    it('handles overnight shifts', () => {
      expect(shiftHours('22:00', '06:00')).toBe(8);
    });

    it('handles shifts with minutes', () => {
      expect(shiftHours('09:30', '17:30')).toBe(8);
    });
  });

  describe('calculateEmployeeLaborCost', () => {
    it('returns 0 for empty shifts', () => {
      expect(calculateEmployeeLaborCost([])).toBe(0);
    });

    it('calculates cost correctly for valid shifts', () => {
      const shifts = [{ start_time: '09:00', end_time: '17:00', hourly_rate: 15 }];
      expect(calculateEmployeeLaborCost(shifts)).toBe(120); // 8h * $15
    });

    it('does not throw when hourly_rate is null', () => {
      const shifts = [{ start_time: '09:00', end_time: '17:00', hourly_rate: null }];
      expect(() => calculateEmployeeLaborCost(shifts)).not.toThrow();
      expect(calculateEmployeeLaborCost(shifts)).toBe(0);
    });

    it('does not throw when hourly_rate is undefined', () => {
      const shifts = [{ start_time: '09:00', end_time: '17:00', hourly_rate: undefined }];
      expect(() => calculateEmployeeLaborCost(shifts)).not.toThrow();
      expect(calculateEmployeeLaborCost(shifts)).toBe(0);
    });

    it('sums multiple shifts correctly', () => {
      const shifts = [
        { start_time: '09:00', end_time: '13:00', hourly_rate: 20 }, // 4h * $20 = $80
        { start_time: '14:00', end_time: '18:00', hourly_rate: 20 }, // 4h * $20 = $80
      ];
      expect(calculateEmployeeLaborCost(shifts)).toBe(160);
    });
  });

  describe('calculateTotalHours', () => {
    it('returns 0 for empty shifts', () => {
      expect(calculateTotalHours([])).toBe(0);
    });

    it('sums hours across multiple shifts', () => {
      const shifts = [
        { start_time: '09:00', end_time: '13:00' },
        { start_time: '14:00', end_time: '18:00' },
      ];
      expect(calculateTotalHours(shifts)).toBe(8);
    });
  });

  describe('EmployeeDetailModal stat derivation', () => {
    it('Number() guard converts null to 0 and still allows toFixed', () => {
      // Simulates what EmployeeDetailModal does with potentially null API values
      const raw: number | null | undefined = null;
      const safe = Number(raw) || 0;
      expect(typeof safe).toBe('number');
      expect(() => safe.toFixed(1)).not.toThrow();
      expect(safe.toFixed(1)).toBe('0.0');
    });

    it('Number() guard converts undefined to 0', () => {
      const raw: number | undefined = undefined;
      const safe = Number(raw) || 0;
      expect(safe).toBe(0);
      expect(() => safe.toFixed(2)).not.toThrow();
    });

    it('Number() guard preserves valid numbers', () => {
      const raw = 123.456;
      const safe = Number(raw) || 0;
      expect(safe).toBeCloseTo(123.456);
      expect(safe.toFixed(1)).toBe('123.5');
    });

    it('Number() guard converts NaN to 0', () => {
      const raw = NaN;
      const safe = Number(raw) || 0;
      expect(safe).toBe(0);
      expect(() => safe.toFixed(0)).not.toThrow();
    });
  });
});
