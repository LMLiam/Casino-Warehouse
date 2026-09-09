import { describe, expect, it } from 'vitest';
import { loadConfig, parseArguments, parseConfig, parseRatio } from '../../../scripts/beat-the-house-analysis/config';
import { createSeededRng } from '../../../scripts/beat-the-house-analysis/rng';
import { densityBinFor, calculateRelativeDensity, simulate } from '../../../scripts/beat-the-house-analysis/simulate';
import { calculateStatistics } from '../../../scripts/beat-the-house-analysis/statistics';

const canonicalConfig = loadConfig('scripts/beat-the-house-analysis/canonical-config.json');
const evidenceConfig = parseConfig({
  ...canonicalConfig,
  configurationId: 'analysis-evidence-test',
  shoes: 1,
  rounds: undefined,
  activeHands: [1],
  cutRange: { minimum: 219, maximum: 219 },
  analysisOnly: true,
  sideBetRatios: Object.fromEntries(
    Object.entries(canonicalConfig.sideBetRatios).map(([sideBet, ratio]) => [sideBet, `${ratio.numerator}/${ratio.denominator}`]),
  ),
  matchPushRatios: canonicalConfig.matchPushRatios.map((ratio) => `${ratio.numerator}/${ratio.denominator}`),
});

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

  it('uses the required density boundaries and public shoe metadata', () => {
    expect(densityBinFor(0.749_999)).toBe('below-0.75');
    expect(densityBinFor(0.75)).toBe('0.75-through-1.25');
    expect(densityBinFor(1.25)).toBe('0.75-through-1.25');
    expect(densityBinFor(1.250_001)).toBe('above-1.25');
    expect(calculateRelativeDensity(6, 12, { cardsRemaining: 156, totalCards: 312 })).toBe(1);
  });

  it('reports penetration and aggregate density evidence without serialised shoe state', () => {
    const first = simulate(evidenceConfig);
    const repeated = simulate(evidenceConfig);
    expect(repeated).toEqual(first);
    const profile = first[0];
    if (!profile) throw new Error('Evidence simulation returned no profile.');
    expect(profile.persistentShoeEvidence.penetrationAtShuffle.sampleSize).toBe(1);
    expect(profile.persistentShoeEvidence.penetrationAtShuffle.mean).toBeGreaterThanOrEqual(219 / 312);
    expect(profile.persistentShoeEvidence.completedRoundsPerShoe.sampleSize).toBe(1);
    expect(Object.keys(profile.persistentShoeEvidence.density)).toEqual(['blackAces', 'twos', 'sevens']);
    expect(
      Object.values(profile.persistentShoeEvidence.density.blackAces).every(
        (bin) => bin.statistics.standardDeviation === null && bin.statistics.standardError === null,
      ),
    ).toBe(true);
    const serialised = JSON.stringify(first);
    for (const forbidden of ['remainingCards', 'cutThresholdCardsDealt', 'shufflePending', 'shoeOrder', 'hiddenCard', 'rankCounts', 'suitCounts']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('parses the canonical command shape', () => {
    expect(parseArguments(['--config', 'canonical.json', '--format', 'json'])).toEqual({ config: 'canonical.json', format: 'json' });
  });
});
