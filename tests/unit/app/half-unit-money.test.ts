import { describe, expect, it } from 'vitest';
import { asHalfUnits } from '../../../src/game/beatTheHouse/asHalfUnits';
import { formatHalfUnits } from '../../../src/shared/formatHalfUnitMoney';

describe('formatHalfUnits', () => {
  it('formats whole and odd half-unit values without decimal noise', () => {
    expect(formatHalfUnits(asHalfUnits(4))).toBe('£2');
    expect(formatHalfUnits(asHalfUnits(5))).toBe('£2.50');
  });

  it('formats signed values with the exact half-credit amount', () => {
    expect(formatHalfUnits(asHalfUnits(-1))).toBe('-£0.50');
    expect(formatHalfUnits(asHalfUnits(5), true)).toBe('+£2.50');
    expect(formatHalfUnits(asHalfUnits(0), true)).toBe('+£0');
  });

  it('rejects a non-integer runtime value at the exact boundary', () => {
    expect(() => formatHalfUnits(0.5 as ReturnType<typeof asHalfUnits>)).toThrow('Half-units must be a safe integer.');
  });
});
