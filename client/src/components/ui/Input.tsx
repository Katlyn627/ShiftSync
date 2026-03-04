import * as React from "react";
import { cn } from "./utils";

export interface InputProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  hint?: string;
}

function Input({ className, type, label, error, hint, id, ...props }: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        type={type}
        id={inputId}
        data-slot="input"
        aria-invalid={!!error || undefined}
        className={cn(
          "flex h-9 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground transition-colors outline-none",
          "focus:border-primary focus:ring-2 focus:ring-primary/20",
          "disabled:pointer-events-none disabled:opacity-50 disabled:bg-muted/50",
          "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export { Input };
export default Input;
