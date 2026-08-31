import { describe, expect, it } from 'vitest';
import { asHalfUnits } from '../../../src/game/beatTheHouse/asHalfUnits';
import { asNonNegativeHalfUnits } from '../../../src/game/beatTheHouse/asNonNegativeHalfUnits';
import { beatTheHouseRules } from '../../../src/game/beatTheHouse/beatTheHouseRules';
import { calculateHalfUnitPayout } from '../../../src/game/beatTheHouse/calculateHalfUnitPayout';
import { wholeChipToHalfUnits } from '../../../src/game/beatTheHouse/wholeChipToHalfUnits';

describe('Beat the House rules and exact payout primitives', () => {
  it('exposes the approved immutable rule values', () => {
    expect(beatTheHouseRules).toEqual({
      deckCount: 6,
      cardsPerDeck: 52,
      cardsPerShoe: 312,
      cutThreshold: { minimum: 219, maximum: 234 },
      maximumPlayerCards: 4,
      maximumDealerCards: 4,
      dealerDrawMaximumRank: 9,
      blackAceProfitRatio: { numerator: 3, denominator: 2 },
      sideBetProfitMultipliers: {
        aceFlashSingle: 12,
        aceFlashBoth: 60,
        dealerBust: 6,
        matchPush: 9,
        dealerSevensOne: 4,
        dealerSevensTwo: 18,
        dealerSevensThree: 150,
        dealerSevensFour: 1000,
      },
      halfUnitsPerWholeChip: 2,
    });
  });

  it.each([
    [1, { numerator: 1, denominator: 1 }, { stakeHalfUnits: 2, profitHalfUnits: 2, returnedHalfUnits: 4 }],
    [1, { numerator: 3, denominator: 2 }, { stakeHalfUnits: 2, profitHalfUnits: 3, returnedHalfUnits: 5 }],
    [2, { numerator: 3, denominator: 2 }, { stakeHalfUnits: 4, profitHalfUnits: 6, returnedHalfUnits: 10 }],
    [3, { numerator: 3, denominator: 2 }, { stakeHalfUnits: 6, profitHalfUnits: 9, returnedHalfUnits: 15 }],
    [1, { numerator: 12, denominator: 1 }, { stakeHalfUnits: 2, profitHalfUnits: 24, returnedHalfUnits: 26 }],
  ] as const)('calculates exact half-unit payout for stake %d', (stake, ratio, expected) => {
    expect(calculateHalfUnitPayout(stake, ratio)).toEqual(expected);
  });

  it('converts whole chips without floating-point money arithmetic', () => {
    expect(wholeChipToHalfUnits(0)).toBe(0);
    expect(wholeChipToHalfUnits(3)).toBe(6);
    expect(asHalfUnits(-3)).toBe(-3);
  });

  it('rejects invalid half-unit and stake values', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => asHalfUnits(value)).toThrow();
    }
    expect(() => asNonNegativeHalfUnits(-1)).toThrow();
    expect(() => wholeChipToHalfUnits(-1)).toThrow();
    expect(() => wholeChipToHalfUnits(1.5)).toThrow();
    expect(() => wholeChipToHalfUnits(Number.MAX_SAFE_INTEGER)).toThrow();
  });

  it('rejects invalid ratios and payouts that are not exactly representable', () => {
    expect(() => calculateHalfUnitPayout(1, { numerator: -1, denominator: 1 })).toThrow();
    expect(() => calculateHalfUnitPayout(1, { numerator: 1, denominator: 0 })).toThrow();
    expect(() => calculateHalfUnitPayout(1, { numerator: 1, denominator: 3 })).toThrow();
    expect(() => calculateHalfUnitPayout(Number.MAX_SAFE_INTEGER, { numerator: 1, denominator: 1 })).toThrow();
  });

  it('preserves half-unit conservation for exact payouts', () => {
    const payout = calculateHalfUnitPayout(3, beatTheHouseRules.blackAceProfitRatio);

    expect(payout.stakeHalfUnits + payout.profitHalfUnits).toBe(payout.returnedHalfUnits);
  });
});
