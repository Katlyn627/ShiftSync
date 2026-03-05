import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        default:     "bg-primary text-white shadow-sm shadow-primary/25 hover:bg-primary/90 active:bg-primary/95",
        destructive: "bg-destructive text-white shadow-sm shadow-destructive/25 hover:bg-destructive/90",
        outline:     "border border-border bg-white text-foreground hover:bg-muted/60 hover:text-foreground",
        secondary:   "bg-muted text-foreground hover:bg-muted/80",
        ghost:       "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        link:        "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 px-3 text-xs rounded-md",
        lg:      "h-10 px-6",
        icon:    "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  disabled,
  children,
  ...props
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="h-4 w-4 animate-spin"
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
    </Comp>
  );
}

export { Button, buttonVariants };
export default Button;
