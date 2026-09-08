import { BeatTheHouseGame } from '../../src/game/engine/BeatTheHouseGame';
import { beatTheHouseRules } from '../../src/game/beatTheHouse/beatTheHouseRules';
import { handIds } from '../../src/game/types/handIds';
import type { HandId } from '../../src/game/types/HandId';
import type { SideBet } from './config';
import type { AnalysisConfig } from './config';
import { createSeededRng } from './rng';
import { createAnalysisShoe } from './shoe';
import { calculateStatistics, type Sample, type SummaryStatistics } from './statistics';

export type ProfileResult = {
  readonly name: string;
  readonly activeHands: number;
  readonly sideBets: readonly SideBet[];
  readonly statistics: SummaryStatistics;
  readonly seatResults: Readonly<Record<HandId, SummaryStatistics>>;
};

const rankValue: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
const action = (config: AnalysisConfig, count: number, value: number): 'hit' | 'stick' => {
  const limit =
    count === 1 ? config.strategyTable.oneCardHitThrough : count === 2 ? config.strategyTable.twoCardHitThrough : config.strategyTable.threeCardHitThrough;
  return value <= limit ? 'hit' : 'stick';
};

const simulateProfile = (config: AnalysisConfig, profileIndex: number, activeHands: readonly HandId[]): ProfileResult => {
  const profile = config.sideBetProfiles[profileIndex];
  if (!profile) throw new Error(`Missing profile ${profileIndex}.`);
  const rng = createSeededRng(config.seed + profileIndex * 97 + activeHands.length * 10_007);
  const game = new BeatTheHouseGame({
    initialBankroll: 100,
    rng,
    randomInt: (maximum) => Math.floor(rng() * maximum),
    shoe: createAnalysisShoe(rng, config.cutRange.minimum, config.cutRange.maximum),
  });
  const samples: Sample[] = [];
  const seatSamples = Object.fromEntries(handIds.map((handId) => [handId, [] as Sample[]])) as Record<HandId, Sample[]>;
  const target = config.rounds ?? Number.MAX_SAFE_INTEGER;
  let rounds = 0;
  let shoeReturned = 0;
  let shoeProfit = 0;
  let shoeStake = 0;
  let shoeRounds = 0;
  let shoeHands = 0;
  while (samples.length < (config.shoes ?? Number.MAX_SAFE_INTEGER) && rounds < target) {
    for (const handId of activeHands) {
      game.placeBet(handId, 'main', 1);
      for (const sideBet of profile.sideBets) game.placeBet(handId, sideBet, 1);
    }
    let snapshot = game.deal();
    while (snapshot.phase === 'playing') {
      const handId = snapshot.activeHand;
      if (!handId) throw new Error('Analysis received a playing snapshot without an active hand.');
      const cards = snapshot.hands[handId].cards;
      const finalCard = cards.at(-1);
      if (!finalCard) throw new Error('Analysis received a hand without a final card.');
      snapshot = action(config, cards.length, rankValue[finalCard.rank] ?? 0) === 'hit' ? game.hit() : game.stick();
    }
    if (snapshot.phase !== 'roundOver') throw new Error('Analysis round did not settle.');
    const stakeHalfUnits = (1 + profile.sideBets.length) * activeHands.length * beatTheHouseRules.halfUnitsPerWholeChip;
    const roundReturned = snapshot.summaries.reduce((total, summary) => total + summary.returnedHalfUnits, 0);
    const roundProfit = snapshot.summaries.reduce((total, summary) => total + summary.profitHalfUnits, 0);
    shoeReturned += roundReturned;
    shoeProfit += roundProfit;
    shoeStake += stakeHalfUnits;
    shoeRounds += 1;
    shoeHands += snapshot.summaries.length;
    for (const summary of snapshot.summaries)
      seatSamples[summary.handId]?.push({
        returnedHalfUnits: summary.returnedHalfUnits,
        profitHalfUnits: summary.profitHalfUnits,
        stakeHalfUnits: (1 + profile.sideBets.length) * 2,
        rounds: 1,
        hands: 1,
      });
    rounds += 1;
    const cutReached = snapshot.shoe.cutCardReached;
    if (cutReached) {
      samples.push({ returnedHalfUnits: shoeReturned, profitHalfUnits: shoeProfit, stakeHalfUnits: shoeStake, rounds: shoeRounds, hands: shoeHands });
      shoeReturned = 0;
      shoeProfit = 0;
      shoeStake = 0;
      shoeRounds = 0;
      shoeHands = 0;
    }
    game.syncBankroll(100);
    game.nextRound();
  }
  if (config.rounds !== undefined && shoeRounds > 0)
    samples.push({ returnedHalfUnits: shoeReturned, profitHalfUnits: shoeProfit, stakeHalfUnits: shoeStake, rounds: shoeRounds, hands: shoeHands });
  return {
    name: profile.name,
    activeHands: activeHands.length,
    sideBets: profile.sideBets,
    statistics: calculateStatistics(samples),
    seatResults: Object.fromEntries(handIds.map((handId) => [handId, calculateStatistics(seatSamples[handId] ?? [])])) as Record<HandId, SummaryStatistics>,
  };
};

export const simulate = (config: AnalysisConfig): ProfileResult[] =>
  config.activeHands.flatMap((handCount) => config.sideBetProfiles.map((_, index) => simulateProfile(config, index, handIds.slice(0, handCount))));
