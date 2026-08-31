/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import SchedulePage from '../pages/SchedulePage';
import { ToastProvider } from '../components/ui/Toast';
import * as api from '../api';

const mockUser = {
  isManager: true,
  employeeName: 'Alice Manager',
  username: 'alice',
  userId: 1,
  employeeId: 1,
  employeeRole: 'Manager',
  photoUrl: null,
  siteId: 1,
};

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
    loading: false,
  }),
}));

const mockSchedules = [
  {
    id: 30,
    week_start: '2026-10-12',
    labor_budget: 5000,
    status: 'draft',
    site_id: 1,
  },
];

// 2 overlapping shifts for Alice on the same day (10:00-16:00 and 14:00-20:00)
const mockOverlappingShifts = [
  {
    id: 301,
    schedule_id: 30,
    employee_id: 1,
    date: '2026-10-12',
    start_time: '10:00',
    end_time: '16:00',
    role: 'Manager',
    status: 'scheduled',
    first_name: 'Alice',
    last_name: 'Manager',
    employee_name: 'Alice Manager',
    employee_role: 'Manager',
  },
  {
    id: 302,
    schedule_id: 30,
    employee_id: 1,
    date: '2026-10-12',
    start_time: '14:00',
    end_time: '20:00',
    role: 'Manager',
    status: 'scheduled',
    first_name: 'Alice',
    last_name: 'Manager',
    employee_name: 'Alice Manager',
    employee_role: 'Manager',
  },
];

describe('SchedulePage - Shift Conflict & Double-Booking Badge', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(api, 'getSchedules').mockResolvedValue(mockSchedules as any);
    vi.spyOn(api, 'getScheduleShifts').mockResolvedValue(mockOverlappingShifts as any);
    vi.spyOn(api, 'getEmployees').mockResolvedValue([] as any);
    vi.spyOn(api, 'getOpenShifts').mockResolvedValue([] as any);
  });

  async function renderSchedulePage() {
    await act(async () => {
      root.render(
        <ToastProvider>
          <SchedulePage />
        </ToastProvider>
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('displays Time Conflict badge on overlapping shifts for the same worker', async () => {
    await renderSchedulePage();

    expect(container.textContent).toContain('Time Conflict (Overlapping)');
  });
});

