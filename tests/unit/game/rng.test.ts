import { describe, expect, it } from 'vitest';
import { secureRandomInt } from '../../../src/game/rng/secureRandomInt';
import { secureRandomUnit } from '../../../src/game/rng/secureRandomUnit';

describe('game RNG abstraction', () => {
  it('rejects invalid integer bounds', () => {
    expect(() => secureRandomInt(0)).toThrow('positive integer bound');
    expect(() => secureRandomInt(1.5)).toThrow('positive integer bound');
  });

  it('returns bounded integer and unit values through the shared RNG helpers', () => {
    const integer = secureRandomInt(10);
    expect(integer).toBeGreaterThanOrEqual(0);
    expect(integer).toBeLessThan(10);

    const unit = secureRandomUnit();
    expect(unit).toBeGreaterThanOrEqual(0);
    expect(unit).toBeLessThan(1);
  });

  it('fails clearly when secure runtime random values are unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

    try {
      expect(() => secureRandomInt(10)).toThrow('secure random values are unavailable');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'crypto', descriptor);
      }
    }
  });
});
