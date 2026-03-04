import { describe, it, expect } from 'vitest';

describe('UI components barrel export', () => {
  it('exports Button', async () => {
    const module = await import('../components/ui');
    // forwardRef components are objects with a render property
    expect(module.Button).toBeTruthy();
  });

  it('exports Card', async () => {
    const module = await import('../components/ui');
    expect(typeof module.Card).toBe('function');
  });

  it('exports Badge', async () => {
    const module = await import('../components/ui');
    expect(typeof module.Badge).toBe('function');
  });

  it('exports Input', async () => {
    const module = await import('../components/ui');
    // forwardRef components are objects with a render property
    expect(module.Input).toBeTruthy();
  });
});

describe('design-tokens', () => {
  it('exports color tokens', async () => {
    const { colors } = await import('../design-tokens');
    expect(colors.brand[700]).toBe('#1d4ed8');
    expect(colors.success.DEFAULT).toBe('#22c55e');
    expect(colors.danger.DEFAULT).toBe('#ef4444');
  });

  it('exports typography tokens', async () => {
    const { typography } = await import('../design-tokens');
    expect(Array.isArray(typography.fontFamily.sans)).toBe(true);
    expect(typography.fontFamily.sans[0]).toBe('Inter');
  });

  it('exports radius tokens', async () => {
    const { radii } = await import('../design-tokens');
    expect(radii.md).toBe('0.5rem');
    expect(radii.full).toBe('9999px');
  });

  it('exports shadow tokens', async () => {
    const { shadows } = await import('../design-tokens');
    expect(typeof shadows.sm).toBe('string');
    expect(shadows.none).toBe('none');
  });
});
