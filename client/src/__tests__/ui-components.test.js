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
describe('ui kit utilities', () => {
    it('exports cn utility', async () => {
        const { cn } = await import('../components/ui');
        expect(typeof cn).toBe('function');
    });
});
