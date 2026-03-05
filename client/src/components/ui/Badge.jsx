import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-primary/10 text-primary",
        secondary:   "bg-muted text-muted-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline:     "border border-border text-foreground bg-transparent",
        // Semantic
        success: "bg-emerald-100 text-emerald-700",
        warning: "bg-amber-100   text-amber-700",
        danger:  "bg-red-100     text-red-700",
        info:    "bg-blue-100    text-blue-700",
        primary: "bg-indigo-100  text-indigo-700",
        // Role variants
        manager: "bg-violet-100 text-violet-700",
        server:  "bg-blue-100   text-blue-700",
        kitchen: "bg-orange-100 text-orange-700",
        bar:     "bg-emerald-100 text-emerald-700",
        host:    "bg-pink-100   text-pink-700",
        // Burnout risk
        "burnout-low":      "bg-emerald-100 text-emerald-700",
        "burnout-moderate": "bg-amber-100   text-amber-700",
        "burnout-high":     "bg-red-100     text-red-700",
        "burnout-critical": "bg-red-600     text-white",
        // Shift status
        "shift-scheduled":   "bg-blue-100   text-blue-700",
        "shift-in-progress": "bg-indigo-100 text-indigo-700",
        "shift-completed":   "bg-emerald-100 text-emerald-700",
        "shift-cancelled":   "bg-slate-100  text-slate-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export default Badge;
