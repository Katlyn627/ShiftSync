import { HTMLAttributes, CSSProperties } from 'react';
import { colors } from '../../design-tokens';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'manager'
  | 'server'
  | 'kitchen'
  | 'bar'
  | 'host'
  // Burnout risk levels
  | 'burnout-low'
  | 'burnout-moderate'
  | 'burnout-high'
  | 'burnout-critical'
  // Shift status
  | 'shift-scheduled'
  | 'shift-in-progress'
  | 'shift-completed'
  | 'shift-cancelled';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Visual style — maps to a Figma badge/tag variant. */
  variant?: BadgeVariant;
}

/**
 * Token-driven badge styles.
 * Semantic variants use Tailwind token classes; role variants use the
 * `colors.roles` design tokens directly as inline styles so no extra
 * Tailwind config entries are needed.
 */
const twVariants: Partial<Record<BadgeVariant, string>> = {
  default:           'bg-neutral-100 text-neutral-700',
  primary:           'bg-brand-100  text-brand-800',
  success:           'bg-success-light text-success-dark',
  warning:           'bg-warning-light text-warning-dark',
  danger:            'bg-danger-light  text-danger-dark',
  info:              'bg-info-light    text-info-dark',
  // Burnout risk levels
  'burnout-low':      'bg-success-light text-success-dark',
  'burnout-moderate': 'bg-warning-light text-warning-dark',
  'burnout-high':     'bg-danger-light  text-danger-dark',
  'burnout-critical': 'bg-danger text-white',
  // Shift status
  'shift-scheduled':   'bg-info-light text-info-dark',
  'shift-in-progress': 'bg-brand-100 text-brand-800',
  'shift-completed':   'bg-success-light text-success-dark',
  'shift-cancelled':   'bg-neutral-100 text-neutral-500',
};

/** Role variants are served from `colors.roles` design tokens. */
function roleStyle(variant: BadgeVariant): CSSProperties | undefined {
  const role = variant as keyof typeof colors.roles;
  if (!(role in colors.roles)) return undefined;
  const { bg, text } = colors.roles[role];
  return { backgroundColor: bg, color: text };
}

/**
 * Badge — compact label component derived from the Figma UI kit.
 *
 * Usage:
 *   <Badge variant="success">Published</Badge>
 *   <Badge variant="warning">Pending</Badge>
 *   <Badge variant="manager">Manager</Badge>
 */
export default function Badge({ variant = 'default', className = '', style, children, ...rest }: BadgeProps) {
  const twClass = twVariants[variant] ?? '';
  const inlineStyle = { ...roleStyle(variant), ...style };
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        twClass,
        className,
      ].join(' ')}
      style={inlineStyle}
      {...rest}
    >
      {children}
    </span>
  );
}
