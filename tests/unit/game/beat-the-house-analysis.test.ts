import { describe, expect, it } from 'vitest';
import { parseArguments, parseConfig, parseRatio } from '../../../scripts/beat-the-house-analysis/config';
import { createSeededRng } from '../../../scripts/beat-the-house-analysis/rng';
import { calculateStatistics } from '../../../scripts/beat-the-house-analysis/statistics';

describe('Beat the House analysis', () => {
  it('parses exact rational ratios and rejects decimal currency values', () => {
    expect(parseRatio('3/10')).toEqual({ numerator: 3, denominator: 10 });
    expect(() => parseRatio('0.3')).toThrow();
  });

  it('rejects simultaneous shoe and round counts', () => {
    const config = {
      configurationId: 'test',
      seed: 1,
      path: 'production',
      shoes: 1,
      rounds: 1,
      activeHands: [1],
      cutRange: { minimum: 219, maximum: 234 },
      sideBetRatios: { aceFlash: '0/1', dealerBust: '0/1', matchPush: '0/1', dealerSevens: '0/1' },
      strategy: 'simple',
      strategyTable: { oneCardHitThrough: 11, twoCardHitThrough: 10, threeCardHitThrough: 10 },
      matchPushRatios: ['0/1'],
      sideBetProfiles: Array.from({ length: 16 }, (_, index) => ({ name: String(index), sideBets: [] })),
    };
    expect(() => parseConfig(config)).toThrow('exactly one');
  });

  it('keeps seeded streams deterministic and uses per-shoe samples', () => {
    const first = createSeededRng(171171);
    const second = createSeededRng(171171);
    expect(Array.from({ length: 5 }, () => first())).toEqual(Array.from({ length: 5 }, () => second()));
    expect(
      calculateStatistics([
        { returnedHalfUnits: 2, profitHalfUnits: 0, stakeHalfUnits: 2, rounds: 4, hands: 4 },
        { returnedHalfUnits: 4, profitHalfUnits: 2, stakeHalfUnits: 2, rounds: 3, hands: 3 },
      ]),
    ).toMatchObject({ sampleSize: 2, totalRounds: 7, totalHands: 7, meanReturned: 1.5 });
  });

  it('parses the canonical command shape', () => {
    expect(parseArguments(['--config', 'canonical.json', '--format', 'json'])).toEqual({ config: 'canonical.json', format: 'json' });
  });
});
