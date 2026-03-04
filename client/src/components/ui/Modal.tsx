import { HTMLAttributes, ReactNode, useEffect } from 'react';
import Button from './Button';

export interface ModalProps {
  /** Controls whether the modal is visible. */
  open: boolean;
  /** Called when the modal requests to be closed (backdrop click, Escape key, or cancel). */
  onClose: () => void;
  /** Modal title displayed in the header. */
  title: string;
  /** Content rendered inside the modal body. */
  children: ReactNode;
  /** Footer action buttons; if omitted no footer is rendered. */
  actions?: ReactNode;
  /** Additional className for the modal panel. */
  className?: string;
}

/**
 * Modal — overlay dialog component derived from the Figma UI kit.
 *
 * Usage:
 *   <Modal open={open} onClose={() => setOpen(false)} title="Confirm">
 *     Are you sure?
 *   </Modal>
 */
export default function Modal({ open, onClose, title, children, actions, className = '' }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={[
          'relative z-10 bg-white rounded-xl shadow-xl w-full max-w-md',
          className,
        ].join(' ')}
      >
        <div className="px-6 pt-5 pb-4">
          <h2 id="modal-title" className="text-lg font-semibold text-neutral-900 mb-2">
            {title}
          </h2>
          <div className="text-sm text-neutral-600">{children}</div>
        </div>
        {actions && (
          <div className="px-6 pb-5 flex gap-2 justify-end border-t border-neutral-100 pt-4">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
