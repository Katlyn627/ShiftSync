import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './utils';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, opts?: { variant?: ToastVariant; duration?: number }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: 'bg-gray-900 text-white border-gray-700',
  success: 'bg-emerald-600 text-white border-emerald-700',
  error:   'bg-red-600 text-white border-red-700',
  warning: 'bg-amber-500 text-white border-amber-600',
  info:    'bg-sky-600 text-white border-sky-700',
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  default: 'ℹ',
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Trigger entrance animation
    const raf = requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration ?? 4000);
    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, onDismiss]);

  const variant = toast.variant ?? 'default';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium max-w-sm w-full pointer-events-auto transition-all duration-300',
        VARIANT_STYLES[variant],
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      )}
    >
      <span className="mt-px text-base leading-none">{VARIANT_ICONS[variant]}</span>
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 300); }}
        className="ml-auto -mr-1 -mt-0.5 w-5 h-5 flex items-center justify-center rounded opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

let _idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, opts?: { variant?: ToastVariant; duration?: number }) => {
    const id = `toast-${++_idCounter}`;
    setToasts(prev => [...prev, { id, message, variant: opts?.variant, duration: opts?.duration }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
