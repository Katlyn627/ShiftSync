import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "./utils";
function Input({ className, type, label, error, hint, id, ...props }) {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (_jsxs("div", { className: "flex flex-col gap-1.5", children: [label && (_jsx("label", { htmlFor: inputId, className: "text-sm font-medium text-foreground", children: label })), _jsx("input", { type: type, id: inputId, "data-slot": "input", "aria-invalid": !!error || undefined, className: cn("flex h-9 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground transition-colors outline-none", "focus:border-primary focus:ring-2 focus:ring-primary/20", "disabled:pointer-events-none disabled:opacity-50 disabled:bg-muted/50", "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20", className), ...props }), error && _jsx("p", { className: "text-xs text-destructive", children: error }), hint && !error && _jsx("p", { className: "text-xs text-muted-foreground", children: hint })] }));
}
export { Input };
export default Input;
