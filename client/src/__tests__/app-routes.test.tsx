/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const mockUser = {
  isManager: false,
  employeeName: 'Taylor Morgan',
  username: 'tmorgan',
  userId: 42,
  employeeId: 7,
  employeeRole: 'Server',
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

vi.mock('../pages/Dashboard', () => ({
  default: () => <div>Dashboard Page</div>,
}));

vi.mock('../pages/OpenShiftsPage', () => ({
  default: () => <div>Open Shifts Page</div>,
}));

vi.mock('../pages/FairnessPage', () => ({
  default: () => <div>Fairness Page</div>,
}));

vi.mock('../pages/SurveysPage', () => ({
  default: () => <div>Surveys Page</div>,
}));

vi.mock('../pages/ProfilePage', () => ({
  default: () => <div>Profile Page</div>,
}));

vi.mock('../pages/TimeOffApprovalsPage', () => ({
  default: () => <div>Time Off Approvals Page</div>,
}));

vi.mock('../pages/EmployeesPage', () => ({
  default: () => <div>Employees Page</div>,
}));

vi.mock('../pages/SwapsPage', () => ({
  default: () => <div>Swaps Page</div>,
}));

vi.mock('../pages/SchedulePage', () => ({
  default: () => <div>Schedule Page</div>,
}));

vi.mock('../pages/LoginPage', () => ({
  default: () => <div>Login Page</div>,
}));

vi.mock('../pages/RegisterBusinessPage', () => ({
  default: () => <div>Register Business Page</div>,
}));

describe('App routing and navigation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);
  });

  async function renderApp(initialEntry = '/dashboard') {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <App />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('shows manager-only routes and nav items for the manager role', async () => {
    mockUser.isManager = true;
    await renderApp('/fairness');

    expect(container.textContent).toContain('Fairness');
    expect(container.textContent).toContain('Time Off');
    expect(container.textContent).toContain('Employees');
    expect(container.textContent).not.toContain('Profile Page');
  });

  it('keeps employee routes available while hiding manager-only items', async () => {
    mockUser.isManager = false;
    await renderApp('/profile');

    expect(container.textContent).toContain('Profile Page');
    expect(container.textContent).toContain('Open Shifts');
    expect(container.textContent).toContain('Surveys');
    expect(container.textContent).not.toContain('Fairness');
    expect(container.textContent).not.toContain('Employees');
  });

  it('allows managers to reach the profile route', async () => {
    mockUser.isManager = true;
    await renderApp('/profile');

    expect(container.textContent).toContain('Profile Page');
  });

  it('redirects inaccessible manager pages for employee users', async () => {
    mockUser.isManager = false;
    await renderApp('/fairness');

    expect(container.textContent).toContain('Dashboard Page');
    expect(container.textContent).not.toContain('Fairness Page');
  });
});
