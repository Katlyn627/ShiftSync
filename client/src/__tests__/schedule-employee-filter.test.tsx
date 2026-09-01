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
  { id: 3, name: 'Carlos Cook', role: 'Cook', department: 'Back of House', hourly_rate: 17, weekly_hours_max: 32, created_at: '2024-01-01' },
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
  {
    id: 403,
    schedule_id: 40,
    employee_id: 3,
    date: '2026-11-09', // Monday
    start_time: '10:00',
    end_time: '18:00',
    role: 'Cook',
    status: 'scheduled',
    employee_name: 'Carlos Cook',
    employee_role: 'Cook',
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
    vi.spyOn(api, 'getStaffingSuggestions').mockResolvedValue([
      {
        date: '2026-11-09',
        day_of_week: 1,
        staffing: [
          { role: 'Manager', start: '09:00', end: '17:00', count: 1 },
          { role: 'Server', start: '12:00', end: '20:00', count: 1 },
        ],
        staffing_suggested: 2,
        staffing_actual: 2,
        staffing_delta: 0,
        staffing_status: 'adequate',
        expected_revenue: 1200,
        role_deltas: [
          { role: 'Manager', delta: 0, suggested: 1, actual: 1 },
          { role: 'Server', delta: 0, suggested: 1, actual: 1 },
        ],
      },
      {
        date: '2026-11-10',
        day_of_week: 2,
        staffing: [
          { role: 'Manager', start: '09:00', end: '17:00', count: 1 },
          { role: 'Server', start: '11:00', end: '18:00', count: 2 },
          { role: 'Kitchen', start: '11:00', end: '18:00', count: 1 },
        ],
        staffing_suggested: 4,
        staffing_actual: 3,
        staffing_delta: -1,
        staffing_status: 'understaffed',
        expected_revenue: 1800,
        role_deltas: [
          { role: 'Manager', delta: 0, suggested: 1, actual: 1 },
          { role: 'Server', delta: -1, suggested: 2, actual: 1 },
          { role: 'Kitchen', delta: 0, suggested: 1, actual: 1 },
        ],
      },
    ]);
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

  it('lets managers switch the schedule between week and day views and keeps recommendations in a day accordion', async () => {
    await act(async () => {
      root!.render(
        <ToastProvider>
          <SchedulePage />
        </ToastProvider>
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const weekButton = buttons.find((button) => button.textContent?.includes('Weekly'));
    const dayButton = buttons.find((button) => button.textContent?.includes('Daily'));

    expect(weekButton).not.toBeNull();
    expect(dayButton).not.toBeNull();

    await act(async () => {
      (dayButton as HTMLButtonElement).click();
    });

    const recommendationSelect = container!.querySelector('select[aria-label="Select recommendation day"]') as HTMLSelectElement | null;
    expect(recommendationSelect).not.toBeNull();
    expect(recommendationSelect?.options.length).toBeGreaterThan(0);
    expect(container!.textContent).toContain('Management');
    expect(container!.textContent).toContain('Front of House');
    expect(container!.textContent).toContain('Back of House');
  });
});
