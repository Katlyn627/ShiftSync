/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import OpenShiftsPage from '../pages/OpenShiftsPage';
import { ToastProvider } from '../components/ui/Toast';
import * as api from '../api';

const mockEmployeeUser = {
  isManager: false,
  employeeName: 'Bob Server',
  username: 'bob',
  userId: 2,
  employeeId: 2,
  employeeRole: 'Server',
  photoUrl: null,
  siteId: 1,
};

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: mockEmployeeUser,
    logout: vi.fn(),
    loading: false,
  }),
}));

const mockOpenShifts = [
  {
    id: 101,
    schedule_id: 1,
    site_id: 1,
    date: '2026-11-02',
    start_time: '10:00',
    end_time: '16:00',
    role: 'Server',
    required_certifications: '[]',
    reason: 'callout',
    status: 'open' as const,
    deadline: null,
    claimed_by: null,
    claimed_by_name: null,
    offer_count: 0,
    created_at: '2026-10-30',
    eligibility: {
      eligible: true,
      reasons: [],
    },
  },
  {
    id: 102,
    schedule_id: 1,
    site_id: 1,
    date: '2026-11-03',
    start_time: '10:00',
    end_time: '16:00',
    role: 'Line Cook',
    required_certifications: '[]',
    reason: 'understaffed',
    status: 'open' as const,
    deadline: null,
    claimed_by: null,
    claimed_by_name: null,
    offer_count: 0,
    created_at: '2026-10-30',
    eligibility: {
      eligible: false,
      reasons: ['Role mismatch: shift requires "Line Cook", your role is "Server"'],
    },
  },
];

describe('OpenShiftsPage - Worker Eligibility Feedback', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(api, 'getOpenShifts').mockResolvedValue(mockOpenShifts as any);
    vi.spyOn(api, 'getSchedules').mockResolvedValue([]);
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <ToastProvider>
          <OpenShiftsPage />
        </ToastProvider>
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('renders "Eligible to claim" for qualifying shifts and "Ineligible" with reasons for non-qualifying', async () => {
    await renderPage();

    expect(container.textContent).toContain('✓ Eligible to claim');
    expect(container.textContent).toContain('✕ Ineligible');
    expect(container.textContent).toContain('Role mismatch: shift requires "Line Cook", your role is "Server"');

    // Button for shift 102 should be disabled
    const buttons = container.querySelectorAll('button');
    const offerButtons = Array.from(buttons).filter((b) => b.textContent?.includes('Offer to Work'));
    expect(offerButtons.length).toBe(2);
    expect(offerButtons[0].hasAttribute('disabled')).toBe(false);
    expect(offerButtons[1].hasAttribute('disabled')).toBe(true);
  });
});
