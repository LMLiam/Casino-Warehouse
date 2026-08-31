import { describe, expect, it } from 'vitest';
import { beatTheHouseRules } from '../../../src/game/beatTheHouse/beatTheHouseRules';
import { createFreshShoeCounts } from '../../../src/game/beatTheHouse/oracle/createFreshShoeCounts';
import { createFreshShoeOracleContext } from '../../../src/game/beatTheHouse/oracle/createFreshShoeOracleContext';
import { evaluateFreshShoeDealer } from '../../../src/game/beatTheHouse/oracle/evaluateFreshShoeDealer';
import { freshShoeCardKinds } from '../../../src/game/beatTheHouse/oracle/freshShoeCardKinds';
import { freshShoeSettlement } from '../../../src/game/beatTheHouse/oracle/freshShoeSettlement';
import type { FreshShoeCounts } from '../../../src/game/beatTheHouse/oracle/FreshShoeCounts';
import { solveFreshShoe } from '../../../src/game/beatTheHouse/oracle/solveFreshShoe';
import { solveFreshShoePlayer } from '../../../src/game/beatTheHouse/oracle/solveFreshShoePlayer';

const kindIndex = (rank: string, suit: string): number => {
  const index = freshShoeCardKinds.findIndex((kind) => kind.rank === rank && kind.suit === suit);
  if (index < 0) {
    throw new Error(`Missing oracle card kind ${rank} ${suit}.`);
  }
  return index;
};

const countsWith = (...kindIndexes: readonly number[]): FreshShoeCounts => {
  const counts = Array.from({ length: freshShoeCardKinds.length }, () => 0);
  for (const index of kindIndexes) {
    const current = counts[index];
    if (current === undefined) {
      throw new Error(`Missing count at index ${index}.`);
    }
    counts[index] = current + 1;
  }
  return counts;
};

const stateForFinalRank = (
  rank: string,
): { readonly counts: FreshShoeCounts; readonly playerFirstKind: number; readonly playerFinalKind: number; readonly playerCardCount: number } => {
  const playerFirstKind = kindIndex('3', 'clubs');
  const playerFinalKind = kindIndex(rank, 'clubs');
  const counts = [...createFreshShoeCounts()];
  const firstCurrent = counts[playerFirstKind];
  if (firstCurrent === undefined) {
    throw new Error(`Missing count at index ${playerFirstKind}.`);
  }
  counts[playerFirstKind] = firstCurrent - 1;
  const finalCurrent = counts[playerFinalKind];
  if (finalCurrent === undefined) {
    throw new Error(`Missing count at index ${playerFinalKind}.`);
  }
  counts[playerFinalKind] = finalCurrent - 1;
  return { counts, playerFirstKind, playerFinalKind, playerCardCount: 2 };
};

describe('fresh-shoe Beat the House oracle', () => {
  it('builds six-deck classes with the approved card population', () => {
    const counts = createFreshShoeCounts();

    expect(counts.reduce((total, count) => total + count, 0)).toBe(beatTheHouseRules.cardsPerShoe);
    expect(counts.slice(0, 12).every((count) => count === 24)).toBe(true);
    expect(counts.slice(12).every((count) => count === 12)).toBe(true);
  });

  it('integrates a hidden dealer card without changing the unseen-card denominator', () => {
    const playerKind = kindIndex('10', 'clubs');
    const kingKind = kindIndex('K', 'clubs');
    const dealerBlackAceKind = kindIndex('A', 'spades');
    const context = createFreshShoeOracleContext({ sideBetRatios: { aceFlash: 1 } });
    const counts = countsWith(kingKind, dealerBlackAceKind);
    const deferred = evaluateFreshShoeDealer(counts, playerKind, playerKind, 'compare', context);
    const explicit =
      (freshShoeSettlement({
        context,
        playerFirstKind: playerKind,
        playerFinalKind: playerKind,
        mainMode: 'compare',
        dealer: { firstKind: kingKind, finalKind: kingKind, bust: false, blackAce: false, sevenCount: 0 },
      }) +
        freshShoeSettlement({
          context,
          playerFirstKind: playerKind,
          playerFinalKind: playerKind,
          mainMode: 'compare',
          dealer: { firstKind: dealerBlackAceKind, bust: false, blackAce: true, sevenCount: 0 },
        })) /
      2;

    expect(deferred).toBe(explicit);
  });

  it('accepts side-bet ratios from zero through one and rejects values outside that range', () => {
    expect(createFreshShoeOracleContext({ sideBetRatios: { matchPush: 0 } }).sideBetRatios.matchPush).toBe(0);
    expect(createFreshShoeOracleContext({ sideBetRatios: { matchPush: 1 } }).sideBetRatios.matchPush).toBe(1);
    expect(() => createFreshShoeOracleContext({ sideBetRatios: { matchPush: -0.1 } })).toThrow();
    expect(() => createFreshShoeOracleContext({ sideBetRatios: { matchPush: 1.1 } })).toThrow();
    expect(() => createFreshShoeOracleContext({ sideBetRatios: { matchPush: Number.NaN } })).toThrow();
  });

  it('evaluates forced terminal outcomes independently of the production engine', () => {
    const context = createFreshShoeOracleContext({});
    const blackAceKind = kindIndex('A', 'spades');
    const tenKind = kindIndex('10', 'clubs');
    const nineKind = kindIndex('9', 'clubs');
    const twoKind = kindIndex('2', 'clubs');

    expect(
      freshShoeSettlement({
        context,
        playerFirstKind: blackAceKind,
        mainMode: 'automaticWin',
        dealer: { firstKind: blackAceKind, bust: false, blackAce: true, sevenCount: 0 },
      }),
    ).toBe(2.5);
    expect(
      freshShoeSettlement({
        context,
        playerFirstKind: tenKind,
        playerFinalKind: tenKind,
        mainMode: 'compare',
        dealer: { firstKind: nineKind, finalKind: nineKind, bust: false, blackAce: false, sevenCount: 0 },
      }),
    ).toBe(2);
    expect(
      freshShoeSettlement({
        context,
        playerFirstKind: tenKind,
        playerFinalKind: tenKind,
        mainMode: 'compare',
        dealer: { firstKind: tenKind, finalKind: tenKind, bust: false, blackAce: false, sevenCount: 0 },
      }),
    ).toBe(1);
    expect(
      freshShoeSettlement({
        context,
        playerFirstKind: twoKind,
        mainMode: 'lose',
        dealer: { firstKind: twoKind, bust: true, blackAce: false, sevenCount: 0 },
      }),
    ).toBe(0);
  });

  it('selects hit or stick by backward induction and changes policy for equal Match Push stake', () => {
    const mainContext = createFreshShoeOracleContext({});
    const matchContext = createFreshShoeOracleContext({ sideBetRatios: { matchPush: 1 } });
    const mainMemo = new Map();
    const mainDealerMemo = new Map();
    const matchMemo = new Map();
    const matchDealerMemo = new Map();
    const decisions = ['10', 'J', 'Q'].map((rank) => solveFreshShoePlayer(stateForFinalRank(rank), mainContext, mainMemo, mainDealerMemo));
    const matchTen = solveFreshShoePlayer(stateForFinalRank('10'), matchContext, matchMemo, matchDealerMemo);
    const matchJack = solveFreshShoePlayer(stateForFinalRank('J'), matchContext, matchMemo, matchDealerMemo);

    expect(decisions.map((decision) => decision.action)).toEqual(['hit', 'stick', 'stick']);
    expect(matchTen.action).toBe('stick');
    expect(matchJack.action).toBe('stick');
  }, 60_000);

  it('returns a deterministic exact fresh-shoe expected value', () => {
    const first = solveFreshShoe();
    const syntheticCounts = countsWith(...freshShoeCardKinds.map((_, index) => index));
    const syntheticFirst = solveFreshShoe({ counts: syntheticCounts });
    const syntheticSecond = solveFreshShoe({ counts: syntheticCounts });

    expect(syntheticSecond).toEqual(syntheticFirst);
    expect(first.totalStake).toBe(1);
    expect(first.expectedProfit / first.totalStake).toBeCloseTo(0.0347, 4);
  }, 180_000);
});
