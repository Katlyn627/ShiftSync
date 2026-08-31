/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import SchedulePage from '../pages/SchedulePage';
import { ToastProvider } from '../components/ui';

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: {
      isManager: true,
      employeeName: 'Manager User',
      username: 'manager',
      userId: 1,
      employeeId: 1,
      employeeRole: 'Manager',
      photoUrl: null,
      siteId: 1,
    },
    logout: vi.fn(),
    loading: false,
  }),
}));

vi.mock('../api', () => ({
  createOpenShift: vi.fn(),
  createShift: vi.fn(),
  createSwap: vi.fn(),
  deleteSchedule: vi.fn(),
  deleteShift: vi.fn(),
  dropShift: vi.fn(),
  generateSchedule: vi.fn(),
  getEmployees: vi.fn().mockResolvedValue([
    { id: 1, name: 'Manager User', role: 'Manager', department: 'Operations', hourly_rate: 20, weekly_hours_max: 40, created_at: '2024-01-01' },
    { id: 2, name: 'Alex Jones', role: 'Server', department: 'Front of House', hourly_rate: 18, weekly_hours_max: 35, created_at: '2024-01-01' },
  ]),
  getAllAvailability: vi.fn().mockResolvedValue([]),
  getOpenShifts: vi.fn().mockResolvedValue([]),
  getStaffingSuggestions: vi.fn().mockResolvedValue([]),
  getScheduleShifts: vi.fn().mockResolvedValue([
    {
      id: 10,
      schedule_id: 1,
      employee_id: 2,
      employee_name: 'Alex Jones',
      employee_department: 'Front of House',
      employee_role: 'Server',
      date: '2024-01-01',
      start_time: '09:00',
      end_time: '17:00',
      role: 'Server',
      created_at: '2024-01-01',
    },
  ]),
  getSchedules: vi.fn().mockResolvedValue([
    { id: 1, week_start: '2024-01-01', labor_budget: 5000, status: 'draft', created_at: '2024-01-01' },
  ]),
  getTimeOffRequests: vi.fn().mockResolvedValue([]),
  offerForOpenShift: vi.fn(),
  updateSchedule: vi.fn(),
  updateShift: vi.fn(),
}));

describe('UI components barrel export', () => {
  it('exports Button', async () => {
    const module = await import('../components/ui');
    // forwardRef components are objects with a render property
    expect(module.Button).toBeTruthy();
  });

  it('exports Card', async () => {
    const module = await import('../components/ui');
    expect(typeof module.Card).toBe('function');
  });

  it('exports Badge', async () => {
    const module = await import('../components/ui');
    expect(typeof module.Badge).toBe('function');
  });

  it('exports Input', async () => {
    const module = await import('../components/ui');
    // forwardRef components are objects with a render property
    expect(module.Input).toBeTruthy();
  });
});

describe('ui kit utilities', () => {
  it('exports cn utility', async () => {
    const { cn } = await import('../components/ui');
    expect(typeof cn).toBe('function');
  });
});

describe('schedule page layout and actions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it('uses a single horizontal week scroll and accessible shift controls', async () => {
    await act(async () => {
      root.render(React.createElement(ToastProvider, null, React.createElement(SchedulePage)));
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const scrollArea = container.querySelector('[data-testid="schedule-week-scroll"]');
    const dayColumns = container.querySelectorAll('[data-testid="schedule-day-column"]');
    const editButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Edit shift for Alex Jones'
    );
    const deleteButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Delete shift for Alex Jones'
    );

    expect(scrollArea).not.toBeNull();
    expect(scrollArea?.className).toContain('overflow-x-auto');
    expect(dayColumns.length).toBeGreaterThan(0);
    expect(Array.from(dayColumns)[0]?.className).toContain('min-w-55');
    expect(editButton).not.toBeNull();
    expect(deleteButton).not.toBeNull();
  });
});
