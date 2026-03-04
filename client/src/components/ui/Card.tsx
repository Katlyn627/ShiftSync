import { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Remove internal padding (useful when embedding a full-bleed image). */
  noPadding?: boolean;
}

/**
 * Card — surface component derived from the Figma UI kit.
 *
 * Usage:
 *   <Card>Content here</Card>
 *   <Card noPadding><img ... /></Card>
 *   <Card className="md:col-span-2">Wide card</Card>
 */
export default function Card({ noPadding = false, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={[
        'bg-white rounded-xl border border-neutral-200 shadow-sm',
        noPadding ? '' : 'p-5',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
