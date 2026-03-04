import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // Semantic variants
        success: "border-transparent bg-green-100 text-green-800",
        warning: "border-transparent bg-yellow-100 text-yellow-800",
        danger:  "border-transparent bg-red-100 text-red-800",
        info:    "border-transparent bg-blue-100 text-blue-800",
        primary: "border-transparent bg-indigo-100 text-indigo-800",
        // Role variants
        manager: "border-transparent bg-violet-100 text-violet-800",
        server:  "border-transparent bg-blue-100 text-blue-800",
        kitchen: "border-transparent bg-orange-100 text-orange-800",
        bar:     "border-transparent bg-green-100 text-green-800",
        host:    "border-transparent bg-pink-100 text-pink-800",
        // Burnout risk variants
        "burnout-low":      "border-transparent bg-green-100 text-green-800",
        "burnout-moderate": "border-transparent bg-yellow-100 text-yellow-800",
        "burnout-high":     "border-transparent bg-red-100 text-red-800",
        "burnout-critical": "border-transparent bg-red-600 text-white",
        // Shift status variants
        "shift-scheduled":    "border-transparent bg-blue-100 text-blue-800",
        "shift-in-progress":  "border-transparent bg-indigo-100 text-indigo-800",
        "shift-completed":    "border-transparent bg-green-100 text-green-800",
        "shift-cancelled":    "border-transparent bg-gray-100 text-gray-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: BadgeProps) {
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
