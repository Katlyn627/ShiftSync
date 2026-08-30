/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import UserMenu from '../components/layout/UserMenu';

const user = {
  userId: 1,
  username: 'ajones',
  employeeId: 7,
  isManager: true,
  employeeName: 'Alex Jones',
  employeeRole: 'Manager',
  photoUrl: null,
  siteId: 1,
};

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

describe('UserMenu', () => {
  let container: HTMLDivElement;
  let root: Root;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);
    logout = vi.fn();
  });

  async function renderMenu() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="*"
              element={(
                <>
                  <UserMenu user={user} onLogout={logout} />
                  <LocationDisplay />
                </>
              )}
            />
            <Route path="/profile" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function getTrigger() {
    return container.querySelector('button[aria-label="User menu"]') as HTMLButtonElement | null;
  }

  function getMenu() {
    return container.querySelector('[role="menu"]') as HTMLElement | null;
  }

  it('opens, closes, and supports keyboard activation', async () => {
    await renderMenu();

    const trigger = getTrigger();
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(getMenu()).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('My Profile');

    await act(async () => {
      trigger?.click();
    });

    expect(getMenu()).toBeNull();
  });

  it('closes on outside click', async () => {
    await renderMenu();

    await act(async () => {
      getTrigger()?.click();
    });

    expect(getMenu()).not.toBeNull();

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    expect(getMenu()).toBeNull();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    await renderMenu();

    const trigger = getTrigger();

    await act(async () => {
      trigger?.click();
    });

    expect(getMenu()).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('My Profile');

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(getMenu()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('navigates to profile', async () => {
    await renderMenu();

    await act(async () => {
      getTrigger()?.click();
    });

    const profileItem = Array.from(container.querySelectorAll('[role="menuitem"]'))[0] as HTMLButtonElement | undefined;
    const logoutItem = Array.from(container.querySelectorAll('[role="menuitem"]'))[1] as HTMLButtonElement | undefined;

    expect(profileItem).toBeTruthy();
    expect(logoutItem).toBeTruthy();

    await act(async () => {
      profileItem?.click();
    });

    expect(container.querySelector('[data-testid="pathname"]')?.textContent).toBe('/profile');
  });

  it('logs out from the dropdown', async () => {
    await renderMenu();

    await act(async () => {
      getTrigger()?.click();
    });

    const logoutItem = Array.from(container.querySelectorAll('[role="menuitem"]'))[1] as HTMLButtonElement | undefined;

    await act(async () => {
      logoutItem?.click();
    });

    expect(logout).toHaveBeenCalledTimes(1);
  });
});