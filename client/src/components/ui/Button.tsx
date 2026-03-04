import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style — maps to a Figma button variant. */
  variant?: ButtonVariant;
  /** Size token — maps to a Figma button size. */
  size?: ButtonSize;
  /** Show a loading spinner and disable interaction. */
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-brand-700 text-white hover:bg-brand-800 border border-transparent',
  secondary: 'bg-white text-brand-700 border border-brand-300 hover:bg-brand-50',
  ghost:     'bg-transparent text-neutral-600 border border-transparent hover:bg-neutral-100',
  danger:    'bg-danger text-white hover:bg-danger-dark border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-base rounded-xl',
};

/**
 * Button — primitive UI component derived from the Figma UI kit.
 *
 * Usage:
 *   <Button variant="primary" size="md" onClick={handleSave}>Save</Button>
 *   <Button variant="secondary" isLoading={submitting}>Submit</Button>
 *   <Button variant="danger" size="sm">Delete</Button>
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      className = '',
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={[
          'inline-flex items-center justify-center font-semibold transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(' ')}
        {...rest}
      >
        {isLoading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
export default Button;
