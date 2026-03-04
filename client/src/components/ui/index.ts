/**
 * ShiftSync UI Component Library
 *
 * These components are built on the Figma design tokens defined in
 * `src/design-tokens.ts`.  Import them individually or from this barrel:
 *
 *   import { Button, Card, Badge, Input } from '@/components/ui';
 *
 * To add a new Figma component:
 *   1. Create `ComponentName.tsx` in this directory.
 *   2. Export it from this file.
 *   3. Reference the design tokens from `src/design-tokens.ts`.
 */
export { default as Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { default as Card } from './Card';
export type { CardProps } from './Card';

export { default as Badge } from './Badge';
export type { BadgeProps, BadgeVariant } from './Badge';
export { default as Input } from './Input';
export type { InputProps } from './Input';
