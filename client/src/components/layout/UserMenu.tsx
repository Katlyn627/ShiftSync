import { ChevronDown, LogOut, UserCircle2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../../AuthContext';
import { Badge } from '../ui';

type UserMenuProps = {
  user: AuthUser;
  onLogout: () => void;
};

function getDisplayName(user: AuthUser): string {
  return user.employeeName || user.username;
}

function getRoleLabel(user: AuthUser): 'Manager' | 'Employee' {
  return user.isManager ? 'Manager' : 'Employee';
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingFocusIndexRef = useRef(0);
  const menuId = useId();
  const displayName = getDisplayName(user);
  const roleLabel = getRoleLabel(user);

  const closeMenu = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const handleAction = (action: () => void) => {
    closeMenu(false);
    action();
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;

    const index = Math.min(Math.max(pendingFocusIndexRef.current, 0), items.length - 1);
    items[index]?.focus();
  }, [open]);

  const focusMenuItem = (index: number) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;

    const nextIndex = ((index % items.length) + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pendingFocusIndexRef.current = 0;
      setOpen(true);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      pendingFocusIndexRef.current = 1;
      setOpen(true);
    }
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusMenuItem(currentIndex < 0 ? 0 : currentIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusMenuItem(currentIndex < 0 ? items.length - 1 : currentIndex - 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem(items.length - 1);
      return;
    }

    if (event.key === 'Tab') {
      closeMenu(false);
    }
  };

  return (
    <div className="relative inline-flex items-start">
      <button
        ref={triggerRef}
        type="button"
        className="flex items-center gap-2 rounded-full border border-border bg-white px-2.5 py-1.5 text-left shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
          {displayName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="User actions"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
        >
          <div className="border-b border-border/70 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                {displayName
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                <div className="mt-2">
                  <Badge variant={user.isManager ? 'manager' : 'default'} className="text-[10px]">
                    {roleLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              onClick={() => handleAction(() => navigate('/profile'))}
            >
              <UserCircle2 className="h-4 w-4 text-muted-foreground" />
              <span>My Profile</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              onClick={() => handleAction(onLogout)}
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}