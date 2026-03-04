import { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label rendered above the input. */
  label?: string;
  /** Error message shown below the input in red. */
  error?: string;
  /** Icon or adornment placed on the left side inside the input. */
  leftAdornment?: ReactNode;
}

/**
 * Input — form field component derived from the Figma UI kit.
 *
 * Usage:
 *   <Input label="Username" placeholder="e.g. alice" />
 *   <Input label="Password" type="password" error={errors.password} />
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftAdornment, className = '', id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAdornment && (
            <span className="absolute left-3 text-neutral-400">{leftAdornment}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full rounded-lg border text-sm transition-colors',
              'placeholder:text-neutral-400',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error
                ? 'border-danger bg-danger-light/30 text-danger-dark'
                : 'border-neutral-300 bg-white text-neutral-900',
              leftAdornment ? 'pl-9 pr-3 py-2' : 'px-3 py-2',
              className,
            ].join(' ')}
            {...rest}
          />
        </div>
        {error && (
          <p className="text-xs text-danger-dark">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
export default Input;
