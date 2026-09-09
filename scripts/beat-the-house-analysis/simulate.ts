import { BeatTheHouseGame } from '../../src/game/engine/BeatTheHouseGame';
import type { Card } from '../../src/game/cards/Card';
import { isBlackAce } from '../../src/game/cards/isBlackAce';
import { suits } from '../../src/game/cards/suits';
import { beatTheHouseRules } from '../../src/game/beatTheHouse/beatTheHouseRules';
import { handIds } from '../../src/game/types/handIds';
import type { HandId } from '../../src/game/types/HandId';
import type { GameSnapshot } from '../../src/game/types/GameSnapshot';
import type { BeatTheHouseShoeSnapshot } from '../../src/game/beatTheHouse/shoe/BeatTheHouseShoeSnapshot';
import type { SideBet } from './config';
import type { AnalysisConfig } from './config';
import { createSeededRng } from './rng';
import { createAnalysisShoe } from './shoe';
import { calculateStatistics, calculateValueStatistics, type Sample, type SummaryStatistics, type ValueStatistics } from './statistics';

export type MetricStatistics = {
  readonly observationUnit: 'shoe';
  readonly denominator: string;
  readonly statistics: SummaryStatistics;
};

export type ProfileMetrics = {
  readonly returnedPerTotalStake: MetricStatistics;
  readonly profitPerTotalStake: MetricStatistics;
  readonly mainReturnedPerMainStake: MetricStatistics;
  readonly mainProfitPerMainStake: MetricStatistics;
  readonly sideBets: Readonly<Record<SideBet, { readonly returnedPerSideStake: MetricStatistics; readonly profitPerSideStake: MetricStatistics }>>;
  readonly seats: Readonly<Record<HandId, { readonly returnedPerSeatStake: MetricStatistics; readonly profitPerSeatStake: MetricStatistics }>>;
};

type DensityTarget = 'blackAces' | 'twos' | 'sevens';
export type DensityBin = 'below-0.75' | '0.75-through-1.25' | 'above-1.25';
type DensityBinResult = {
  readonly observationUnit: 'round';
  readonly denominator: 'roundStakeHalfUnits';
  readonly totals: {
    readonly returnedHalfUnits: number;
    readonly profitHalfUnits: number;
    readonly stakeHalfUnits: number;
  };
  readonly statistics: SummaryStatistics;
};
type PersistentShoeEvidence = {
  readonly penetrationAtShuffle: ValueStatistics;
  readonly completedRoundsPerShoe: ValueStatistics;
  readonly density: Readonly<Record<DensityTarget, Readonly<Record<DensityBin, DensityBinResult>>>>;
};

export type ProfileResult = {
  readonly name: string;
  readonly activeHands: number;
  readonly sideBets: readonly SideBet[];
  readonly strategy: AnalysisConfig['strategy'];
  readonly sideBetRatios: Readonly<Record<SideBet, string>>;
  readonly strategyTable: AnalysisConfig['strategyTable'];
  readonly assertedMetrics: readonly string[];
  readonly metrics: ProfileMetrics;
  readonly statistics: SummaryStatistics;
  readonly seatResults: Readonly<Record<HandId, SummaryStatistics>>;
  readonly persistentShoeEvidence: PersistentShoeEvidence;
};

const rankValue: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
const densityTargets: readonly DensityTarget[] = ['blackAces', 'twos', 'sevens'];
const densityBins: readonly DensityBin[] = ['below-0.75', '0.75-through-1.25', 'above-1.25'];
const lowerDensityBoundary = 0.75;
const upperDensityBoundary = 1.25;
const cardsPerRank = suits.length;
const blackAcesPerDeck = suits.filter((suit) => suit === 'spades' || suit === 'clubs').length;
const initialDensityTargets: Readonly<Record<DensityTarget, number>> = {
  blackAces: beatTheHouseRules.deckCount * blackAcesPerDeck,
  twos: beatTheHouseRules.deckCount * cardsPerRank,
  sevens: beatTheHouseRules.deckCount * cardsPerRank,
};
const action = (config: AnalysisConfig, count: number, value: number): 'hit' | 'stick' => {
  const limit =
    count === 1 ? config.strategyTable.oneCardHitThrough : count === 2 ? config.strategyTable.twoCardHitThrough : config.strategyTable.threeCardHitThrough;
  return value <= limit ? 'hit' : 'stick';
};

type MetricName =
  | 'returnedPerTotalStake'
  | 'profitPerTotalStake'
  | 'mainReturnedPerMainStake'
  | 'mainProfitPerMainStake'
  | `${SideBet}ReturnedPerSideStake`
  | `${SideBet}ProfitPerSideStake`
  | `${HandId}ReturnedPerSeatStake`
  | `${HandId}ProfitPerSeatStake`;

const metricDenominator = (name: MetricName): string =>
  name.includes('Total')
    ? 'totalStakeHalfUnits'
    : name.includes('Main')
      ? 'mainStakeHalfUnits'
      : name.includes('Side')
        ? 'sideBetStakeHalfUnits'
        : 'seatStakeHalfUnits';

const addMetricSample = (samples: Record<MetricName, Sample[]>, name: MetricName, sample: Sample): void => {
  samples[name].push(sample);
};

type DensityCounts = Record<DensityTarget, number>;
type DensitySamples = Record<DensityTarget, Record<DensityBin, Sample[]>>;
export type PublicShoeMetadata = Pick<BeatTheHouseShoeSnapshot, 'cardsRemaining' | 'totalCards'>;

const emptyDensityCounts = (): DensityCounts => ({ blackAces: 0, twos: 0, sevens: 0 });

const emptyDensitySamples = (): DensitySamples => ({
  blackAces: { 'below-0.75': [], '0.75-through-1.25': [], 'above-1.25': [] },
  twos: { 'below-0.75': [], '0.75-through-1.25': [], 'above-1.25': [] },
  sevens: { 'below-0.75': [], '0.75-through-1.25': [], 'above-1.25': [] },
});

export const calculateRelativeDensity = (remainingTarget: number, initialTarget: number, shoe: PublicShoeMetadata): number =>
  remainingTarget / initialTarget / (shoe.cardsRemaining / shoe.totalCards);

export const densityBinFor = (relativeDensity: number): DensityBin =>
  relativeDensity < lowerDensityBoundary ? 'below-0.75' : relativeDensity <= upperDensityBoundary ? '0.75-through-1.25' : 'above-1.25';

const densityTargetForCard = (card: Card): DensityTarget | undefined => {
  if (isBlackAce(card)) return 'blackAces';
  if (card.rank === '2') return 'twos';
  if (card.rank === '7') return 'sevens';
  return undefined;
};

const countRevealedTargets = (snapshot: GameSnapshot): DensityCounts => {
  const counts = emptyDensityCounts();
  const cards = [...handIds.flatMap((handId) => snapshot.hands[handId].cards), ...snapshot.dealer.cards];
  for (const card of cards) {
    const target = densityTargetForCard(card);
    if (target) counts[target] += 1;
  }
  return counts;
};

const addDensityCounts = (current: DensityCounts, revealed: DensityCounts): DensityCounts => ({
  blackAces: current.blackAces + revealed.blackAces,
  twos: current.twos + revealed.twos,
  sevens: current.sevens + revealed.sevens,
});

const roundStartShoe = (snapshot: GameSnapshot): PublicShoeMetadata =>
  snapshot.shoe.cutCardReached ? { cardsRemaining: snapshot.shoe.totalCards, totalCards: snapshot.shoe.totalCards } : snapshot.shoe;

const densityBinsAtRoundStart = (snapshot: GameSnapshot, revealed: DensityCounts): Record<DensityTarget, DensityBin> => {
  const shoe = roundStartShoe(snapshot);
  return {
    blackAces: densityBinFor(calculateRelativeDensity(initialDensityTargets.blackAces - revealed.blackAces, initialDensityTargets.blackAces, shoe)),
    twos: densityBinFor(calculateRelativeDensity(initialDensityTargets.twos - revealed.twos, initialDensityTargets.twos, shoe)),
    sevens: densityBinFor(calculateRelativeDensity(initialDensityTargets.sevens - revealed.sevens, initialDensityTargets.sevens, shoe)),
  };
};

const densityBinResult = (samples: readonly Sample[]): DensityBinResult => {
  const totals = samples.reduce(
    (current, sample) => ({
      returnedHalfUnits: current.returnedHalfUnits + sample.returnedHalfUnits,
      profitHalfUnits: current.profitHalfUnits + sample.profitHalfUnits,
      stakeHalfUnits: current.stakeHalfUnits + sample.stakeHalfUnits,
    }),
    { returnedHalfUnits: 0, profitHalfUnits: 0, stakeHalfUnits: 0 },
  );
  return {
    observationUnit: 'round',
    denominator: 'roundStakeHalfUnits',
    totals,
    statistics: {
      meanReturned: totals.stakeHalfUnits === 0 ? 0 : totals.returnedHalfUnits / totals.stakeHalfUnits,
      meanProfit: totals.stakeHalfUnits === 0 ? 0 : totals.profitHalfUnits / totals.stakeHalfUnits,
      standardDeviation: null,
      standardError: null,
      sampleSize: samples.length,
      totalRounds: samples.reduce((total, sample) => total + sample.rounds, 0),
      totalHands: samples.reduce((total, sample) => total + sample.hands, 0),
    },
  };
};

const densityResultsForTarget = (samples: DensitySamples, target: DensityTarget): Record<DensityBin, DensityBinResult> =>
  Object.fromEntries(densityBins.map((bin) => [bin, densityBinResult(samples[target][bin])])) as Record<DensityBin, DensityBinResult>;

const densityResults = (samples: DensitySamples): Readonly<Record<DensityTarget, Readonly<Record<DensityBin, DensityBinResult>>>> => ({
  blackAces: densityResultsForTarget(samples, 'blackAces'),
  twos: densityResultsForTarget(samples, 'twos'),
  sevens: densityResultsForTarget(samples, 'sevens'),
});

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
  const metricNames: MetricName[] = [
    'returnedPerTotalStake',
    'profitPerTotalStake',
    'mainReturnedPerMainStake',
    'mainProfitPerMainStake',
    ...profile.sideBets.flatMap((sideBet) => [`${sideBet}ReturnedPerSideStake`, `${sideBet}ProfitPerSideStake`] as const),
    ...activeHands.flatMap((handId) => [`${handId}ReturnedPerSeatStake`, `${handId}ProfitPerSeatStake`] as const),
  ];
  const metricSamples = Object.fromEntries(metricNames.map((name) => [name, [] as Sample[]])) as Record<MetricName, Sample[]>;
  const shoeMetrics = Object.fromEntries(metricNames.map((name) => [name, { returnedHalfUnits: 0, profitHalfUnits: 0, stakeHalfUnits: 0 }])) as Record<
    MetricName,
    { returnedHalfUnits: number; profitHalfUnits: number; stakeHalfUnits: number }
  >;
  const target = config.rounds ?? Number.MAX_SAFE_INTEGER;
  let rounds = 0;
  let shoeReturned = 0;
  let shoeProfit = 0;
  let shoeStake = 0;
  let shoeRounds = 0;
  let shoeHands = 0;
  let revealedCounts = emptyDensityCounts();
  const densitySamples = emptyDensitySamples();
  const penetrationSamples: number[] = [];
  const completedRoundSamples: number[] = [];
  while (samples.length < (config.shoes ?? Number.MAX_SAFE_INTEGER) && rounds < target) {
    const roundStartSnapshot = game.snapshot();
    if (roundStartSnapshot.shoe.cutCardReached) revealedCounts = emptyDensityCounts();
    const roundDensityBins = densityBinsAtRoundStart(roundStartSnapshot, revealedCounts);
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
    const roundSample: Sample = {
      returnedHalfUnits: roundReturned,
      profitHalfUnits: roundProfit,
      stakeHalfUnits,
      rounds: 1,
      hands: snapshot.summaries.length,
    };
    for (const targetName of densityTargets) densitySamples[targetName][roundDensityBins[targetName]].push(roundSample);
    revealedCounts = addDensityCounts(revealedCounts, countRevealedTargets(snapshot));
    const mainStakeHalfUnits = beatTheHouseRules.halfUnitsPerWholeChip;
    const sideStakeHalfUnits = beatTheHouseRules.halfUnitsPerWholeChip;
    const seatStakeHalfUnits = (1 + profile.sideBets.length) * mainStakeHalfUnits;
    const addRoundMetric = (name: MetricName, returnedHalfUnits: number, profitHalfUnits: number, stakeHalfUnits: number): void => {
      shoeMetrics[name].returnedHalfUnits += name.includes('Profit') ? profitHalfUnits : returnedHalfUnits;
      shoeMetrics[name].profitHalfUnits += profitHalfUnits;
      shoeMetrics[name].stakeHalfUnits += stakeHalfUnits;
    };
    addRoundMetric('returnedPerTotalStake', roundReturned, roundProfit, stakeHalfUnits);
    for (const summary of snapshot.summaries) {
      const mainReturnedHalfUnits = summary.mainProfitHalfUnits + mainStakeHalfUnits;
      addRoundMetric('mainReturnedPerMainStake', mainReturnedHalfUnits, summary.mainProfitHalfUnits, mainStakeHalfUnits);
      for (const sideBet of profile.sideBets) {
        const sideWin = summary.sideWins.find((win) => win.betType === sideBet);
        addRoundMetric(`${sideBet}ReturnedPerSideStake`, sideWin?.returnedHalfUnits ?? 0, sideWin?.profitHalfUnits ?? -sideStakeHalfUnits, sideStakeHalfUnits);
        addRoundMetric(
          `${sideBet}ProfitPerSideStake`,
          sideWin?.profitHalfUnits ?? -sideStakeHalfUnits,
          sideWin?.profitHalfUnits ?? -sideStakeHalfUnits,
          sideStakeHalfUnits,
        );
      }
      addRoundMetric(`${summary.handId}ReturnedPerSeatStake`, summary.returnedHalfUnits, summary.profitHalfUnits, seatStakeHalfUnits);
      addRoundMetric(`${summary.handId}ProfitPerSeatStake`, summary.returnedHalfUnits - seatStakeHalfUnits, summary.profitHalfUnits, seatStakeHalfUnits);
      seatSamples[summary.handId]?.push({
        returnedHalfUnits: summary.returnedHalfUnits,
        profitHalfUnits: summary.profitHalfUnits,
        stakeHalfUnits: seatStakeHalfUnits,
        rounds: 1,
        hands: 1,
      });
    }
    addRoundMetric('profitPerTotalStake', roundProfit, roundProfit, stakeHalfUnits);
    addRoundMetric('mainProfitPerMainStake', roundProfit, roundProfit, stakeHalfUnits);
    rounds += 1;
    const cutReached = snapshot.shoe.cutCardReached;
    if (cutReached) {
      penetrationSamples.push(snapshot.shoe.cardsDealt / snapshot.shoe.totalCards);
      completedRoundSamples.push(shoeRounds);
    }
    if (cutReached || (config.rounds !== undefined && rounds === target)) {
      samples.push({ returnedHalfUnits: shoeReturned, profitHalfUnits: shoeProfit, stakeHalfUnits: shoeStake, rounds: shoeRounds, hands: shoeHands });
      for (const name of metricNames) {
        const metric = shoeMetrics[name];
        addMetricSample(metricSamples, name, { ...metric, rounds: shoeRounds, hands: shoeHands });
        metric.returnedHalfUnits = 0;
        metric.profitHalfUnits = 0;
        metric.stakeHalfUnits = 0;
      }
      shoeReturned = 0;
      shoeProfit = 0;
      shoeStake = 0;
      shoeRounds = 0;
      shoeHands = 0;
    }
    game.syncBankroll(100);
    game.nextRound();
  }
  if (config.rounds !== undefined && shoeRounds > 0) {
    samples.push({ returnedHalfUnits: shoeReturned, profitHalfUnits: shoeProfit, stakeHalfUnits: shoeStake, rounds: shoeRounds, hands: shoeHands });
    for (const name of metricNames) addMetricSample(metricSamples, name, { ...shoeMetrics[name], rounds: shoeRounds, hands: shoeHands });
  }
  const metric = (name: MetricName): MetricStatistics => ({
    observationUnit: 'shoe',
    denominator: metricDenominator(name),
    statistics: calculateStatistics(metricSamples[name]),
  });
  const metricKey = (name: MetricName): string =>
    name.includes('ReturnedPerTotalStake')
      ? 'returnedPerTotalStake'
      : name.includes('ProfitPerTotalStake')
        ? 'profitPerTotalStake'
        : name.includes('MainReturnedPerMainStake')
          ? 'mainReturnedPerMainStake'
          : name.includes('MainProfitPerMainStake')
            ? 'mainProfitPerMainStake'
            : name.includes('ReturnedPerSideStake')
              ? `${name.replace('ReturnedPerSideStake', '')}.returnedPerSideStake`
              : name.includes('ProfitPerSideStake')
                ? `${name.replace('ProfitPerSideStake', '')}.profitPerSideStake`
                : name.includes('ReturnedPerSeatStake')
                  ? `${name.replace('ReturnedPerSeatStake', '')}.returnedPerSeatStake`
                  : `${name.replace('ProfitPerSeatStake', '')}.profitPerSeatStake`;
  const sideBets = Object.fromEntries(
    profile.sideBets.map((sideBet) => [
      sideBet,
      { returnedPerSideStake: metric(`${sideBet}ReturnedPerSideStake`), profitPerSideStake: metric(`${sideBet}ProfitPerSideStake`) },
    ]),
  ) as ProfileMetrics['sideBets'];
  const seats = Object.fromEntries(
    activeHands.map((handId) => [
      handId,
      { returnedPerSeatStake: metric(`${handId}ReturnedPerSeatStake`), profitPerSeatStake: metric(`${handId}ProfitPerSeatStake`) },
    ]),
  ) as ProfileMetrics['seats'];
  return {
    name: profile.name,
    activeHands: activeHands.length,
    sideBets: profile.sideBets,
    strategy: config.strategy,
    sideBetRatios: Object.fromEntries(Object.entries(config.sideBetRatios).map(([name, ratio]) => [name, `${ratio.numerator}/${ratio.denominator}`])) as Record<
      SideBet,
      string
    >,
    strategyTable: config.strategyTable,
    assertedMetrics: metricNames.map(metricKey),
    metrics: {
      returnedPerTotalStake: metric('returnedPerTotalStake'),
      profitPerTotalStake: metric('profitPerTotalStake'),
      mainReturnedPerMainStake: metric('mainReturnedPerMainStake'),
      mainProfitPerMainStake: metric('mainProfitPerMainStake'),
      sideBets,
      seats,
    },
    statistics: calculateStatistics(samples),
    seatResults: Object.fromEntries(handIds.map((handId) => [handId, calculateStatistics(seatSamples[handId] ?? [])])) as Record<HandId, SummaryStatistics>,
    persistentShoeEvidence: {
      penetrationAtShuffle: calculateValueStatistics(penetrationSamples),
      completedRoundsPerShoe: calculateValueStatistics(completedRoundSamples),
      density: densityResults(densitySamples),
    },
  };
};

export const simulate = (config: AnalysisConfig): ProfileResult[] =>
  config.activeHands.flatMap((handCount) => config.sideBetProfiles.map((_, index) => simulateProfile(config, index, handIds.slice(0, handCount))));
