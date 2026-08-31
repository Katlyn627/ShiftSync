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
    id: 20,
    week_start: '2026-10-05',
    labor_budget: 5000,
    status: 'draft',
    site_id: 1,
  },
];

// 2 shifts for Alice: closing at 23:00 on Monday, opening at 07:00 on Tuesday (8h rest = clopening)
const mockClopenShifts = [
  {
    id: 201,
    schedule_id: 20,
    employee_id: 1,
    date: '2026-10-05',
    start_time: '15:00',
    end_time: '23:00',
    role: 'Manager',
    status: 'scheduled',
    first_name: 'Alice',
    last_name: 'Manager',
    employee_name: 'Alice Manager',
    employee_role: 'Manager',
  },
  {
    id: 202,
    schedule_id: 20,
    employee_id: 1,
    date: '2026-10-06',
    start_time: '07:00',
    end_time: '15:00',
    role: 'Manager',
    status: 'scheduled',
    first_name: 'Alice',
    last_name: 'Manager',
    employee_name: 'Alice Manager',
    employee_role: 'Manager',
  },
];

describe('SchedulePage - Rest Window & Clopening Badge', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(api, 'getSchedules').mockResolvedValue(mockSchedules as any);
    vi.spyOn(api, 'getScheduleShifts').mockResolvedValue(mockClopenShifts as any);
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

  it('displays quick-return clopening warning badge on the second shift', async () => {
    await renderSchedulePage();

    expect(container.textContent).toContain('8h rest (clopen)');
  });
});

