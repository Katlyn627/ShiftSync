/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import EmployeesPage from '../pages/EmployeesPage';
import { ToastProvider } from '../components/ui';

const { importEmployeesMock } = vi.hoisted(() => ({
  importEmployeesMock: vi.fn(),
}));

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
  getEmployees: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: 'Alex Jones',
      role: 'Server',
      department: 'Front of House',
      hourly_rate: 18,
      weekly_hours_max: 35,
      email: 'alex@example.com',
      phone: '555-0101',
      created_at: '2024-01-01',
      site_id: 1,
    },
  ]),
  getSites: vi.fn().mockResolvedValue([
    { id: 1, name: 'Downtown', city: 'Austin', state: 'TX' },
  ]),
  getPositions: vi.fn().mockResolvedValue([
    { id: 1, name: 'Server', is_active: 1 },
  ]),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  importEmployees: importEmployeesMock,
}));

describe('Employees import disclosure', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    importEmployeesMock.mockReset();
    importEmployeesMock.mockResolvedValue({ imported: 1, employees: [] });

    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);
  });

  async function renderPage() {
    await act(async () => {
      root.render(React.createElement(ToastProvider, null, React.createElement(EmployeesPage)));
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('hides import controls by default and marks control as collapsed', async () => {
    await renderPage();

    const toggleButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Import Employees',
    );

    expect(toggleButton).not.toBeNull();
    expect(toggleButton?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#employee-import-panel')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('opens import controls and keeps import submission connected', async () => {
    await renderPage();

    const toggleButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Import Employees',
    );
    expect(toggleButton).not.toBeNull();

    await act(async () => {
      toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(toggleButton?.getAttribute('aria-expanded')).toBe('true');

    const panel = container.querySelector('#employee-import-panel');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('region');
    expect(panel?.getAttribute('aria-labelledby')).toBe('employee-import-panel-label');

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();

    const panelImportButton = panel
      ? Array.from(panel.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Import Employees')
      : null;

    expect(panelImportButton).not.toBeNull();

    await act(async () => {
      panelImportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Paste employee data first.');

    await act(async () => {
      if (!textarea) return;
      const setNativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setNativeValue?.call(textarea, 'name,role\nJane Smith,Server');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      panelImportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(importEmployeesMock).toHaveBeenCalledTimes(1);
    expect(importEmployeesMock).toHaveBeenCalledWith('name,role\nJane Smith,Server', 'auto');
  });
});
