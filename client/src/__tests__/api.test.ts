import { describe, it, expect } from 'vitest';

// Unit tests for API helper types and utility functions
describe('API module', () => {
  it('is importable', async () => {
    // Just test the module can be imported (integration tests need a running server)
    const module = await import('../api');
    expect(typeof module.getEmployees).toBe('function');
    expect(typeof module.generateSchedule).toBe('function');
    expect(typeof module.getBurnoutRisks).toBe('function');
    expect(typeof module.getLaborCost).toBe('function');
    expect(typeof module.getSwaps).toBe('function');
    expect(typeof module.approveSwap).toBe('function');
    expect(typeof module.rejectSwap).toBe('function');
  });
});