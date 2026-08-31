/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
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
    id: 40,
    week_start: '2026-11-09',
    labor_budget: 5000,
    status: 'draft',
    site_id: 1,
  },
];

const mockEmployees = [
  { id: 1, name: 'Alice Manager', role: 'Manager', department: 'Management', hourly_rate: 30, weekly_hours_max: 40, created_at: '2024-01-01' },
  { id: 2, name: 'Bob Server', role: 'Server', department: 'Front of House', hourly_rate: 15, weekly_hours_max: 30, created_at: '2024-01-01' },
];

const mockShifts = [
  {
    id: 401,
    schedule_id: 40,
    employee_id: 1,
    date: '2026-11-09', // Monday
    start_time: '09:00',
    end_time: '17:00',
    role: 'Manager',
    status: 'scheduled',
    employee_name: 'Alice Manager',
    employee_role: 'Manager',
  },
  {
    id: 402,
    schedule_id: 40,
    employee_id: 2,
    date: '2026-11-10', // Tuesday
    start_time: '12:00',
    end_time: '20:00',
    role: 'Server',
    status: 'scheduled',
    employee_name: 'Bob Server',
    employee_role: 'Server',
  },
];

const mockTimeOff = [
  {
    id: 1,
    employee_id: 2,
    employee_name: 'Bob Server',
    start_date: '2026-11-11', // Wednesday
    end_date: '2026-11-11',
    reason: 'Vacation',
    status: 'approved' as const,
    manager_notes: null,
    created_at: '2026-11-01T12:00:00Z',
  },
];

const mockAvailability = [
  {
    id: 10,
    employee_id: 2,
    day_of_week: 4, // Thursday
    start_time: '00:00',
    end_time: '00:00',
    availability_type: 'unavailable' as const,
  },
];

describe('Schedule Page Employee Filter and Overlays', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(api, 'getSchedules').mockResolvedValue(mockSchedules);
    vi.spyOn(api, 'getEmployees').mockResolvedValue(mockEmployees);
    vi.spyOn(api, 'getScheduleShifts').mockResolvedValue(mockShifts);
    vi.spyOn(api, 'getOpenShifts').mockResolvedValue([]);
    vi.spyOn(api, 'getTimeOffRequests').mockResolvedValue(mockTimeOff);
    vi.spyOn(api, 'getAllAvailability').mockResolvedValue(mockAvailability);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    if (container) {
      document.body.removeChild(container);
    }
  });

  it('renders employee filter and displays availability and time-off requests when filtered', async () => {
    await act(async () => {
      root!.render(
        <ToastProvider>
          <SchedulePage />
        </ToastProvider>
      );
    });

    // Wait for async load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Find Employee Filter select
    const selectElements = container!.querySelectorAll('select');
    let employeeFilterSelect: HTMLSelectElement | null = null;

    selectElements.forEach((el) => {
      const parentLabel = el.previousElementSibling;
      if (parentLabel && parentLabel.textContent === 'Employee Filter') {
        employeeFilterSelect = el as HTMLSelectElement;
      }
    });

    expect(employeeFilterSelect).not.toBeNull();
    
    // Switch filter to "Bob Server" (id: 2)
    await act(async () => {
      employeeFilterSelect!.value = '2';
      employeeFilterSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Verify Bob's scheduled statistics are displayed
    expect(container!.innerHTML).toContain('Bob Server');
    expect(container!.innerHTML).toContain('scheduled (max 30h)');

    // Verify Bob's overlays:
    // Wednesday (2026-11-11) has approved time off
    expect(container!.innerHTML).toContain('Time-Off Approved');
    
    // Thursday (2026-11-12) has Unavailable preference
    expect(container!.innerHTML).toContain('Unavailable');
  });
});
