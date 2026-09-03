import { describe, expect, it } from 'vitest';
import { beatTheHouseRules } from '../../../src/game/beatTheHouse/beatTheHouseRules';
import type { Card } from '../../../src/game/cards/Card';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { BetType } from '../../../src/game/types/BetType';

type SideBet = Exclude<BetType, 'main'>;
type BeatAction = 'hit' | 'stick';
type MainMode = 'automaticWin' | 'compare' | 'lose';
type CardKind = {
  readonly label: string;
  readonly rank: Card['rank'];
  readonly suit: Card['suit'];
  readonly count: number;
  readonly value: number;
  readonly blackAce: boolean;
};
type StrategyRow = {
  readonly oneCardHitThrough: number;
  readonly twoCardHitThrough: number;
  readonly threeCardHitThrough: number;
};
type WagerProfile = {
  readonly name: string;
  readonly sideBets: readonly SideBet[];
  readonly stake: number;
  readonly expectedReturned: number;
  readonly expectedRtp: number;
  readonly roundStandardDeviationEnvelope: number;
  readonly strategy: StrategyRow;
};
type RoundStats = {
  readonly mean: number;
  readonly standardDeviation: number;
};
type DealerOutcome = {
  first: number;
  finalValue?: number | undefined;
  bust: boolean;
  blackAce: boolean;
  sevenCount: number;
};

const TWO_VALUE = 2;
const THREE_VALUE = 3;
const FOUR_VALUE = 4;
const FIVE_VALUE = 5;
const SIX_VALUE = 6;
const SEVEN_VALUE = 7;
const EIGHT_VALUE = 8;
const NINE_VALUE = 9;
const TEN_VALUE = 10;
const JACK_VALUE = 11;
const QUEEN_VALUE = 12;
const KING_VALUE = 13;
const ACE_VALUE = 14;
const CARDS_PER_RANK_PER_DECK = 4;
const ACES_PER_COLOUR_PER_DECK = 2;
const SIX_DECK_RANK_COUNT = CARDS_PER_RANK_PER_DECK * beatTheHouseRules.deckCount;
const SIX_DECK_ACE_COLOR_COUNT = ACES_PER_COLOUR_PER_DECK * beatTheHouseRules.deckCount;
const MAX_PLAYER_CARDS = 4;
const MAX_DEALER_CARDS = 4;
const MAIN_STAKE = 1;
const SIDE_STAKE = 1;
const MAIN_WIN_RETURNED = 2;
const MAIN_PUSH_RETURNED = 1;
const ACE_FLASH_SINGLE_RETURNED = 11;
const ACE_FLASH_BOTH_RETURNED = 51;
const DEALER_BUST_RETURNED = 5;
const MATCH_PUSH_RETURNED = 10;
const THREE_SEVENS_COUNT = 3;
const FOUR_SEVENS_COUNT = 4;
const DEALER_SEVENS_RETURNED = {
  oneSeven: 4,
  twoSevens: 19,
  threeSevens: 151,
  fourSevens: 1001,
} as const;
const MONTE_CARLO_SEED = 171_171;
const RTP_SAMPLE_ROUNDS_PER_PROFILE = 20_000;
const ACTION_VALUE_SAMPLE_ROUNDS = 20_000;
const MONTE_CARLO_SIGMA_TOLERANCE = 6;
const MIN_RETURN_TOLERANCE = 0.05;
const RTP_GUARDRAIL_TEST_TIMEOUT_MS = 120_000;
const MAIN_ONLY_J_ACTION_MARGIN = 0.01;
const MATCH_PUSH_J_ACTION_MARGIN = 0.01;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_FIRST_SHIFT = 15;
const MULBERRY_SECOND_SHIFT = 7;
const MULBERRY_SECOND_MULTIPLIER = 61;
const MULBERRY_FINAL_SHIFT = 14;
const UNSIGNED_32BIT_RANGE = 4_294_967_296;

const rankValues: Record<Card['rank'], number> = {
  '2': TWO_VALUE,
  '3': THREE_VALUE,
  '4': FOUR_VALUE,
  '5': FIVE_VALUE,
  '6': SIX_VALUE,
  '7': SEVEN_VALUE,
  '8': EIGHT_VALUE,
  '9': NINE_VALUE,
  '10': TEN_VALUE,
  J: JACK_VALUE,
  Q: QUEEN_VALUE,
  K: KING_VALUE,
  A: ACE_VALUE,
};
const cardKinds = [
  { label: '2', rank: '2', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: TWO_VALUE, blackAce: false },
  { label: '3', rank: '3', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: THREE_VALUE, blackAce: false },
  { label: '4', rank: '4', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: FOUR_VALUE, blackAce: false },
  { label: '5', rank: '5', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: FIVE_VALUE, blackAce: false },
  { label: '6', rank: '6', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: SIX_VALUE, blackAce: false },
  { label: '7', rank: '7', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: SEVEN_VALUE, blackAce: false },
  { label: '8', rank: '8', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: EIGHT_VALUE, blackAce: false },
  { label: '9', rank: '9', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: NINE_VALUE, blackAce: false },
  { label: '10', rank: '10', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: TEN_VALUE, blackAce: false },
  { label: 'J', rank: 'J', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: JACK_VALUE, blackAce: false },
  { label: 'Q', rank: 'Q', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: QUEEN_VALUE, blackAce: false },
  { label: 'K', rank: 'K', suit: 'clubs', count: SIX_DECK_RANK_COUNT, value: KING_VALUE, blackAce: false },
  { label: 'black A', rank: 'A', suit: 'spades', count: SIX_DECK_ACE_COLOR_COUNT, value: ACE_VALUE, blackAce: true },
  { label: 'red A', rank: 'A', suit: 'hearts', count: SIX_DECK_ACE_COLOR_COUNT, value: ACE_VALUE, blackAce: false },
] as const satisfies readonly CardKind[];
const initialCounts = cardKinds.map((kind) => kind.count);

const requireKind = (index: number): CardKind => {
  const kind = cardKinds[index];
  if (!kind) {
    throw new Error(`Missing card kind at index ${index}.`);
  }
  return kind;
};

// Shared forced cases: first-card black Ace auto-wins, first-card 2 auto-loses, hit 2 loses, and four player cards force standing.
const mainOnlyStrategy = { oneCardHitThrough: JACK_VALUE, twoCardHitThrough: JACK_VALUE, threeCardHitThrough: TEN_VALUE } as const;
const matchPushStrategy = { oneCardHitThrough: TEN_VALUE, twoCardHitThrough: TEN_VALUE, threeCardHitThrough: TEN_VALUE } as const;

// The per-round standard deviations are conservative envelopes for the fixed simulation scope.
// Expected returns are exact six-deck values for the fixed strategy and current engine payouts.
const wagerProfiles = [
  profile('main-only', [], 0.976099349, 0.976099349, 1.5, mainOnlyStrategy),
  profile('aceFlash', ['aceFlash'], 1.861704098, 0.930852049, 5.0, mainOnlyStrategy),
  profile('dealerBust', ['dealerBust'], 1.834417295, 0.917208648, 3.0, mainOnlyStrategy),
  profile('aceFlash+dealerBust', ['aceFlash', 'dealerBust'], 2.720022044, 0.906674015, 6.0, mainOnlyStrategy),
  profile('matchPush', ['matchPush'], 2.063005562, 1.031502781, 4.0, matchPushStrategy),
  profile('aceFlash+matchPush', ['aceFlash', 'matchPush'], 2.948610311, 0.982870104, 6.0, matchPushStrategy),
  profile('dealerBust+matchPush', ['dealerBust', 'matchPush'], 2.921323508, 0.973774503, 5.0, matchPushStrategy),
  profile('aceFlash+dealerBust+matchPush', ['aceFlash', 'dealerBust', 'matchPush'], 3.806928257, 0.951732064, 7.0, matchPushStrategy),
  profile('dealerSevens', ['dealerSevens'], 2.003985852, 1.001992926, 20.0, mainOnlyStrategy),
  profile('aceFlash+dealerSevens', ['aceFlash', 'dealerSevens'], 2.8895906, 0.963196867, 20.0, mainOnlyStrategy),
  profile('dealerBust+dealerSevens', ['dealerBust', 'dealerSevens'], 2.862303797, 0.954101266, 20.0, mainOnlyStrategy),
  profile('aceFlash+dealerBust+dealerSevens', ['aceFlash', 'dealerBust', 'dealerSevens'], 3.747908546, 0.936977137, 20.0, mainOnlyStrategy),
  profile('matchPush+dealerSevens', ['matchPush', 'dealerSevens'], 3.090892065, 1.030297355, 20.0, matchPushStrategy),
  profile('aceFlash+matchPush+dealerSevens', ['aceFlash', 'matchPush', 'dealerSevens'], 3.976496814, 0.994124203, 20.0, matchPushStrategy),
  profile('dealerBust+matchPush+dealerSevens', ['dealerBust', 'matchPush', 'dealerSevens'], 3.949210011, 0.987302503, 20.0, matchPushStrategy),
  profile(
    'aceFlash+dealerBust+matchPush+dealerSevens',
    ['aceFlash', 'dealerBust', 'matchPush', 'dealerSevens'],
    4.83481476,
    0.966962952,
    20.0,
    matchPushStrategy,
  ),
] as const satisfies readonly WagerProfile[];

const requireWagerProfile = (index: number): WagerProfile => {
  const profile = wagerProfiles[index];
  if (!profile) {
    throw new Error(`Missing wager profile at index ${index}.`);
  }
  return profile;
};

describe('Beat the House RTP guardrails', () => {
  it('documents every normalized wager profile and the optimal strategy row used by the RTP guardrail', () => {
    expect(wagerProfiles).toHaveLength(16);

    for (const wagerProfile of wagerProfiles) {
      expect(wagerProfile.stake, wagerProfile.name).toBe(MAIN_STAKE + wagerProfile.sideBets.length * SIDE_STAKE);
      expect(strategyAction(wagerProfile.strategy, 1, TEN_VALUE), wagerProfile.name).toBe('hit');
      expect(strategyAction(wagerProfile.strategy, 2, TEN_VALUE), wagerProfile.name).toBe('hit');
      expect(strategyAction(wagerProfile.strategy, 3, TEN_VALUE), wagerProfile.name).toBe('hit');

      if (wagerProfile.sideBets.includes('matchPush')) {
        expect(strategyAction(wagerProfile.strategy, 1, JACK_VALUE), wagerProfile.name).toBe('stick');
        expect(strategyAction(wagerProfile.strategy, 2, JACK_VALUE), wagerProfile.name).toBe('stick');
      } else {
        expect(strategyAction(wagerProfile.strategy, 1, JACK_VALUE), wagerProfile.name).toBe('hit');
        expect(strategyAction(wagerProfile.strategy, 2, JACK_VALUE), wagerProfile.name).toBe('hit');
      }

      expect(strategyAction(wagerProfile.strategy, 3, JACK_VALUE), wagerProfile.name).toBe('stick');
      expect(strategyAction(wagerProfile.strategy, 1, QUEEN_VALUE), wagerProfile.name).toBe('stick');
      expect(strategyAction(wagerProfile.strategy, 2, KING_VALUE), wagerProfile.name).toBe('stick');
      expect(strategyAction(wagerProfile.strategy, 3, ACE_VALUE), wagerProfile.name).toBe('stick');
    }
  });

  it('includes active side-bet returns when checking the J hit/stick action value', () => {
    const mainOnly = requireWagerProfile(0);
    const matchPush = requireWagerProfile(4);
    const oneCardJack = [kindIndex('J')];
    const twoCardJack = [kindIndex('3'), kindIndex('J')];

    expect(estimatedActionValue(mainOnly, oneCardJack, 'hit', MONTE_CARLO_SEED).mean).toBeGreaterThan(
      estimatedActionValue(mainOnly, oneCardJack, 'stick', MONTE_CARLO_SEED + 1).mean + MAIN_ONLY_J_ACTION_MARGIN,
    );
    expect(estimatedActionValue(mainOnly, twoCardJack, 'hit', MONTE_CARLO_SEED + 2).mean).toBeGreaterThan(
      estimatedActionValue(mainOnly, twoCardJack, 'stick', MONTE_CARLO_SEED + 3).mean + MAIN_ONLY_J_ACTION_MARGIN,
    );
    expect(estimatedActionValue(matchPush, oneCardJack, 'stick', MONTE_CARLO_SEED + 4).mean).toBeGreaterThan(
      estimatedActionValue(matchPush, oneCardJack, 'hit', MONTE_CARLO_SEED + 5).mean + MATCH_PUSH_J_ACTION_MARGIN,
    );
    expect(estimatedActionValue(matchPush, twoCardJack, 'stick', MONTE_CARLO_SEED + 6).mean).toBeGreaterThan(
      estimatedActionValue(matchPush, twoCardJack, 'hit', MONTE_CARLO_SEED + 7).mean + MATCH_PUSH_J_ACTION_MARGIN,
    );
  });

  it(
    'keeps production BeatTheHouseGame returns inside seeded RTP guardrails for all 16 profiles',
    () => {
      for (const [profileIndex, wagerProfile] of wagerProfiles.entries()) {
        const observed = simulateProductionProfile(wagerProfile, MONTE_CARLO_SEED + profileIndex);
        const standardError = wagerProfile.roundStandardDeviationEnvelope / Math.sqrt(RTP_SAMPLE_ROUNDS_PER_PROFILE);
        const tolerance = Math.max(MIN_RETURN_TOLERANCE, standardError * MONTE_CARLO_SIGMA_TOLERANCE);

        expect(Math.abs(observed.mean - wagerProfile.expectedReturned), wagerProfile.name).toBeLessThanOrEqual(tolerance);
        expect(observed.standardDeviation, wagerProfile.name).toBeLessThanOrEqual(wagerProfile.roundStandardDeviationEnvelope);
        expect(observed.mean / wagerProfile.stake, wagerProfile.name).toBeCloseTo(wagerProfile.expectedRtp, 1);
      }
    },
    RTP_GUARDRAIL_TEST_TIMEOUT_MS,
  );
});

function profile(
  name: string,
  sideBets: readonly SideBet[],
  expectedReturned: number,
  expectedRtp: number,
  roundStandardDeviationEnvelope: number,
  strategy: StrategyRow,
): WagerProfile {
  return {
    name,
    sideBets,
    stake: MAIN_STAKE + sideBets.length * SIDE_STAKE,
    expectedReturned,
    expectedRtp,
    roundStandardDeviationEnvelope,
    strategy,
  };
}

function strategyAction(strategy: StrategyRow, cardCount: number, finalRankValue: number): BeatAction {
  const hitThrough = cardCount === 1 ? strategy.oneCardHitThrough : cardCount === 2 ? strategy.twoCardHitThrough : strategy.threeCardHitThrough;
  return finalRankValue <= hitThrough ? 'hit' : 'stick';
}

function simulateProductionProfile(wagerProfile: WagerProfile, seed: number): RoundStats {
  const rng = mulberry32(seed);
  const returned: number[] = [];
  const game = new BeatTheHouseGame({ initialBankroll: wagerProfile.stake, rng });

  for (let round = 0; round < RTP_SAMPLE_ROUNDS_PER_PROFILE; round += 1) {
    game.placeBet('left', 'main', MAIN_STAKE);
    for (const sideBet of wagerProfile.sideBets) {
      game.placeBet('left', sideBet, SIDE_STAKE);
    }

    let snapshot = game.deal();
    while (snapshot.phase === 'playing') {
      const activeHand = snapshot.activeHand;
      if (!activeHand) {
        throw new Error('Missing activeHand.');
      }
      const cards = snapshot.hands[activeHand].cards;
      const finalCard = cards.at(-1);
      if (!finalCard) {
        throw new Error('Missing finalCard.');
      }
      const finalRankValue = rankValues[finalCard.rank];
      const action = strategyAction(wagerProfile.strategy, cards.length, finalRankValue);
      snapshot = action === 'hit' ? game.hit() : game.stick();
    }
    const summary = snapshot.summaries[0];
    if (!summary) {
      throw new Error('Missing summary.');
    }
    returned.push(summary.returned);
    if (round + 1 < RTP_SAMPLE_ROUNDS_PER_PROFILE) {
      game.syncBankroll(wagerProfile.stake);
      game.nextRound();
    }
  }

  return sampleStats(returned);
}

function estimatedActionValue(wagerProfile: WagerProfile, visibleHand: readonly number[], firstAction: BeatAction, seed: number): RoundStats {
  const rng = mulberry32(seed);
  const returned: number[] = [];

  for (let round = 0; round < ACTION_VALUE_SAMPLE_ROUNDS; round += 1) {
    const counts = removeCards(initialCounts, visibleHand);
    const firstVisible = visibleHand[0];
    if (firstVisible === undefined) {
      throw new Error('Missing firstVisible.');
    }
    const lastVisible = visibleHand.at(-1);
    if (lastVisible === undefined) {
      throw new Error('Missing lastVisible.');
    }
    returned.push(playPlayerContinuation(wagerProfile, counts, firstVisible, lastVisible, visibleHand.length, firstAction, rng));
  }

  return sampleStats(returned);
}

function playPlayerContinuation(
  wagerProfile: WagerProfile,
  counts: readonly number[],
  playerFirst: number,
  playerFinal: number,
  playerCardCount: number,
  action: BeatAction,
  rng: () => number,
): number {
  if (action === 'stick') {
    return simulateDealerAndSettle(wagerProfile, counts, playerFirst, requireKind(playerFinal).value, 'compare', rng);
  }

  const { drawn, nextCounts } = drawKind(counts, rng);
  if (requireKind(drawn).value === TWO_VALUE) {
    return simulateDealerAndSettle(wagerProfile, nextCounts, playerFirst, undefined, 'lose', rng);
  }
  if (playerCardCount + 1 >= MAX_PLAYER_CARDS) {
    return simulateDealerAndSettle(wagerProfile, nextCounts, playerFirst, requireKind(drawn).value, 'compare', rng);
  }

  const nextAction = strategyAction(wagerProfile.strategy, playerCardCount + 1, requireKind(drawn).value);
  return playPlayerContinuation(wagerProfile, nextCounts, playerFirst, drawn, playerCardCount + 1, nextAction, rng);
}

function simulateDealerAndSettle(
  wagerProfile: WagerProfile,
  counts: readonly number[],
  playerFirst: number,
  playerFinalValue: number | undefined,
  mainMode: MainMode,
  rng: () => number,
): number {
  const firstDraw = drawKind(counts, rng);
  let nextCounts = firstDraw.nextCounts;
  const first = firstDraw.drawn;
  const firstKind = requireKind(first);
  const dealer: DealerOutcome = {
    first,
    finalValue: firstKind.value,
    bust: firstKind.value === TWO_VALUE,
    blackAce: firstKind.blackAce,
    sevenCount: firstKind.value === SEVEN_VALUE ? 1 : 0,
  };

  if (!dealer.blackAce && !dealer.bust) {
    let dealerCardCount = 1;
    while (dealer.finalValue !== undefined && dealer.finalValue <= TEN_VALUE && dealerCardCount < MAX_DEALER_CARDS) {
      const dealerDraw = drawKind(nextCounts, rng);
      nextCounts = dealerDraw.nextCounts;
      const drawnKind = requireKind(dealerDraw.drawn);
      dealerCardCount += 1;
      dealer.finalValue = drawnKind.value;
      dealer.sevenCount += drawnKind.value === SEVEN_VALUE ? 1 : 0;
      if (drawnKind.value === TWO_VALUE) {
        dealer.bust = true;
        dealer.finalValue = undefined;
        break;
      }
    }
  }

  return settleReturned(wagerProfile, playerFirst, playerFinalValue, mainMode, dealer);
}

function settleReturned(
  wagerProfile: WagerProfile,
  playerFirst: number,
  playerFinalValue: number | undefined,
  mainMode: MainMode,
  dealer: DealerOutcome,
): number {
  const mainResult = mainResultFor(playerFinalValue, mainMode, dealer);
  let returned = mainResult === 'win' ? MAIN_WIN_RETURNED : mainResult === 'push' ? MAIN_PUSH_RETURNED : 0;

  if (wagerProfile.sideBets.includes('aceFlash')) {
    const playerAce = requireKind(playerFirst).blackAce;
    const dealerAce = requireKind(dealer.first).blackAce;
    returned += playerAce && dealerAce ? ACE_FLASH_BOTH_RETURNED : playerAce || dealerAce ? ACE_FLASH_SINGLE_RETURNED : 0;
  }
  if (wagerProfile.sideBets.includes('dealerBust') && dealer.bust) {
    returned += DEALER_BUST_RETURNED;
  }
  if (
    wagerProfile.sideBets.includes('matchPush') &&
    mainResult !== 'lose' &&
    !dealer.bust &&
    !dealer.blackAce &&
    playerFinalValue !== undefined &&
    dealer.finalValue !== undefined &&
    playerFinalValue === dealer.finalValue
  ) {
    returned += MATCH_PUSH_RETURNED;
  }
  if (wagerProfile.sideBets.includes('dealerSevens')) {
    returned += dealerSevensReturned(dealer.sevenCount);
  }

  return returned;
}

function mainResultFor(playerFinalValue: number | undefined, mainMode: MainMode, dealer: DealerOutcome): 'lose' | 'push' | 'win' {
  if (mainMode === 'lose') {
    return 'lose';
  }
  if (mainMode === 'automaticWin') {
    return 'win';
  }
  if (dealer.blackAce) {
    return 'lose';
  }
  if (dealer.bust) {
    return 'win';
  }
  if (playerFinalValue === undefined || dealer.finalValue === undefined) {
    return 'lose';
  }
  if (playerFinalValue > dealer.finalValue) {
    return 'win';
  }
  if (playerFinalValue === dealer.finalValue) {
    return 'push';
  }
  return 'lose';
}

function dealerSevensReturned(sevenCount: number): number {
  if (sevenCount === 1) {
    return DEALER_SEVENS_RETURNED.oneSeven;
  }
  if (sevenCount === 2) {
    return DEALER_SEVENS_RETURNED.twoSevens;
  }
  if (sevenCount === THREE_SEVENS_COUNT) {
    return DEALER_SEVENS_RETURNED.threeSevens;
  }
  if (sevenCount === FOUR_SEVENS_COUNT) {
    return DEALER_SEVENS_RETURNED.fourSevens;
  }
  return 0;
}

function drawKind(counts: readonly number[], rng: () => number): { readonly drawn: number; readonly nextCounts: readonly number[] } {
  let draw = Math.floor(rng() * totalCards(counts));
  for (const [index, count] of counts.entries()) {
    if (draw >= count) {
      draw -= count;
      continue;
    }
    const nextCounts = [...counts];
    const current = nextCounts[index];
    if (current === undefined) {
      throw new Error(`Missing count at index ${index}.`);
    }
    nextCounts[index] = current - 1;
    return { drawn: index, nextCounts };
  }
  throw new Error('Card draw failed.');
}

function removeCards(counts: readonly number[], cardIndexes: readonly number[]): readonly number[] {
  const nextCounts = [...counts];
  for (const cardIndex of cardIndexes) {
    const current = nextCounts[cardIndex];
    if (current === undefined) {
      throw new Error(`Missing count at card index ${cardIndex}.`);
    }
    nextCounts[cardIndex] = current - 1;
  }
  return nextCounts;
}

function totalCards(counts: readonly number[]): number {
  return counts.reduce((total, count) => total + count, 0);
}

function kindIndex(label: CardKind['label']): number {
  const index = cardKinds.findIndex((kind) => kind.label === label);
  if (index < 0) {
    throw new Error(`Unknown card kind ${label}.`);
  }
  return index;
}

function sampleStats(values: readonly number[]): RoundStats {
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) * (value - mean), 0) / values.length;
  return { mean, standardDeviation: Math.sqrt(variance) };
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + MULBERRY_INCREMENT) | 0;
    let value = Math.imul(state ^ (state >>> MULBERRY_FIRST_SHIFT), 1 | state);
    value = (value + Math.imul(value ^ (value >>> MULBERRY_SECOND_SHIFT), MULBERRY_SECOND_MULTIPLIER | value)) ^ value;
    return ((value ^ (value >>> MULBERRY_FINAL_SHIFT)) >>> 0) / UNSIGNED_32BIT_RANGE;
  };
}
