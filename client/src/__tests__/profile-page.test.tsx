/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ProfilePage from '../pages/ProfilePage';

const mockUser = {
  userId: 1,
  username: 'ajones',
  employeeId: 7,
  isManager: false,
  employeeName: 'Alex Jones',
  employeeRole: 'Server',
  photoUrl: null,
  siteId: 1,
};

const mockApi = vi.hoisted(() => ({
  getEmployees: vi.fn(),
  updateEmployee: vi.fn(),
  getAvailability: vi.fn(),
  setAvailability: vi.fn(),
  deleteAvailability: vi.fn(),
  getTimeOffRequests: vi.fn(),
  createTimeOffRequest: vi.fn(),
  cancelTimeOffRequest: vi.fn(),
}));

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
    loading: false,
  }),
}));

vi.mock('../api', () => mockApi);

describe('ProfilePage states', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);
    vi.resetAllMocks();
  });

  async function renderPage() {
    await act(async () => {
      root.render(<ProfilePage />);
    });
  }

  it('shows a loading state while data is fetching', async () => {
    mockApi.getEmployees.mockReturnValue(new Promise(() => {}));

    await renderPage();

    expect(container.textContent).toContain('Loading profile…');
  });

  it('shows an API error state when profile loading fails', async () => {
    mockApi.getEmployees.mockRejectedValue(new Error('Network unavailable'));

    await renderPage();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Unable to load profile');
    expect(container.textContent).toContain('We couldn’t load your profile. Please try again.');
  });

  it('shows an unlinked-account state when no matching employee exists', async () => {
    mockApi.getEmployees.mockResolvedValue([
      { id: 99, name: 'Different Employee', role: 'Server', department: 'FOH', hourly_rate: 18, weekly_hours_max: 40, created_at: '2024-01-01' },
    ]);
    mockApi.getTimeOffRequests.mockResolvedValue([]);

    await renderPage();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('not linked to an employee profile');
    expect(container.textContent).toContain('@ajones');
  });
});