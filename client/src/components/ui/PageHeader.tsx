import * as React from "react";
import { cn } from "./utils";

export interface PageHeaderProps {
  /** Page title – rendered in the Sora heading font */
  title: string;
  /** Short descriptor shown beneath the title */
  subtitle?: string;
  /** Hex color that drives the per-page accent (gradient, icon bg, border) */
  color: string;
  /** Optional icon element (emoji string or React node) */
  icon?: React.ReactNode;
  /** Optional right-side action buttons / controls */
  actions?: React.ReactNode;
  /** Extra className applied to the outer wrapper */
  className?: string;
}

/**
 * PageHeader
 *
 * A colorful, gradient-tinted banner rendered at the top of each page.
 * Each page passes its own `color` value to produce a distinctive identity
 * while staying visually cohesive with the overall ShiftSync brand.
 *
 * Usage:
 *   <PageHeader
 *     title="Schedule Builder"
 *     subtitle="Plan and publish your team's weekly shifts"
 *     color="#0D9488"
 *     icon="📅"
 *     actions={<Button>Generate</Button>}
 *   />
 */
export function PageHeader({
  title,
  subtitle,
  color,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn("relative rounded-2xl overflow-hidden mb-6 px-5 py-4 sm:px-6 sm:py-5 border", className)}
      style={{
        background: `linear-gradient(135deg, ${color}1A 0%, ${color}0D 60%, transparent 100%)`,
        borderColor: `${color}33`,
      }}
    >
      {/* Decorative ambient orb – top-right */}
      <div
        className="absolute -right-6 -top-6 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: color, opacity: 0.10, filter: 'blur(2rem)' }}
        aria-hidden="true"
      />
      {/* Decorative ambient orb – bottom-left */}
      <div
        className="absolute -left-4 bottom-0 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: color, opacity: 0.06, filter: 'blur(1.5rem)' }}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        {/* Left: icon + title + subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          {icon != null && (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg shadow-sm select-none"
              style={{
                background: `${color}22`,
                color,
                boxShadow: `0 2px 8px ${color}22`,
              }}
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1
              className="font-heading text-xl font-bold text-foreground leading-tight tracking-tight truncate"
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: action controls */}
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0 self-start">
            {actions}
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-30"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
        aria-hidden="true"
      />
    </div>
  );
}

export default PageHeader;
