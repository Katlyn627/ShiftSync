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
    id: 10,
    week_start: '2026-09-01',
    labor_budget: 5000,
    status: 'draft',
    site_id: 1,
  },
];

const mockShifts = [
  {
    id: 101,
    schedule_id: 10,
    employee_id: 1,
    date: '2026-09-01',
    start_time: '09:00',
    end_time: '17:00',
    role: 'Manager',
    status: 'scheduled',
    first_name: 'Alice',
    last_name: 'Manager',
  },
];

describe('SchedulePage - New / Copy Week Modal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(api, 'getSchedules').mockResolvedValue(mockSchedules as any);
    vi.spyOn(api, 'getScheduleShifts').mockResolvedValue(mockShifts as any);
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

  it('renders "New / Copy Week" button for managers and opens the modal', async () => {
    await renderSchedulePage();

    const copyWeekBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('New / Copy Week')
    );
    expect(copyWeekBtn).toBeDefined();

    await act(async () => {
      copyWeekBtn?.click();
    });

    expect(document.body.textContent).toContain('Create or Copy Schedule Week');
    expect(document.body.textContent).toContain('Duplicate Active Week');
    expect(document.body.textContent).toContain('Auto-Generate with AI');
  });

  it('calls duplicateSchedule when Duplicate Week is submitted', async () => {
    const duplicateSpy = vi.spyOn(api, 'duplicateSchedule').mockResolvedValue({
      id: 11,
      week_start: '2026-09-08',
      labor_budget: 5000,
      status: 'draft',
      site_id: 1,
    } as any);

    await renderSchedulePage();

    const copyWeekBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('New / Copy Week')
    );
    await act(async () => {
      copyWeekBtn?.click();
    });

    const submitBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Duplicate Week')
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn?.click();
    });

    expect(duplicateSpy).toHaveBeenCalledTimes(1);
    expect(duplicateSpy).toHaveBeenCalledWith(10, expect.objectContaining({
      target_week_start: expect.any(String),
    }));
  });
});
