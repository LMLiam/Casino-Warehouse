/* eslint-disable no-restricted-syntax */
import { readFileSync } from 'node:fs';
import type { BetType } from '../../src/game/types/BetType';
import { beatTheHouseRules } from '../../src/game/beatTheHouse/beatTheHouseRules';

type AnalysisPath = 'production' | 'oracle';
export type AnalysisFormat = 'json' | 'markdown';
export type SideBet = Exclude<BetType, 'main'>;
export type Ratio = { readonly numerator: number; readonly denominator: number };
type StrategyRow = { readonly oneCardHitThrough: number; readonly twoCardHitThrough: number; readonly threeCardHitThrough: number };
export type AnalysisConfig = {
  readonly configurationId: string;
  readonly seed: number;
  readonly path: AnalysisPath;
  readonly shoes?: number;
  readonly rounds?: number;
  readonly activeHands: readonly number[];
  readonly cutRange: { readonly minimum: number; readonly maximum: number };
  readonly analysisOnly: boolean;
  readonly sideBetProfiles: readonly { readonly name: string; readonly sideBets: readonly SideBet[] }[];
  readonly sideBetRatios: Readonly<Record<SideBet, Ratio>>;
  readonly strategy: 'simple' | 'match-push' | 'oracle-optimal';
  readonly strategyTable: StrategyRow;
  readonly matchPushRatios: readonly Ratio[];
};

const sideBetNames: readonly SideBet[] = ['aceFlash', 'dealerBust', 'matchPush', 'dealerSevens'];
const maxCount = 100_000;

export const ratioToString = (ratio: Ratio): string => `${ratio.numerator}/${ratio.denominator}`;

export const parseRatio = (value: string): Ratio => {
  const match = /^(\d+)\/(\d+)$/.exec(value);
  const numerator = Number(match?.[1]);
  const denominator = Number(match?.[2]);
  if (!match || !Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0 || numerator < 0 || numerator > denominator) {
    throw new Error(`Invalid ratio: ${value}. Use an exact ratio in the range 0/1 through 1/1.`);
  }
  return { numerator, denominator };
};

const requireCount = (value: unknown, name: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > maxCount) {
    throw new Error(`${name} must be a positive safe integer no greater than ${maxCount}.`);
  }
  return value;
};

export const parseConfig = (value: unknown): AnalysisConfig => {
  if (!value || typeof value !== 'object') throw new Error('Analysis configuration must be an object.');
  const input = value as Record<string, unknown>;
  if (typeof input.configurationId !== 'string' || input.configurationId.length === 0) throw new Error('configurationId is required.');
  if (typeof input.seed !== 'number' || !Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 4_294_967_295)
    throw new Error('seed must be an unsigned 32-bit integer.');
  const seed = input.seed;
  const path = input.path === 'oracle' ? 'oracle' : input.path === 'production' ? 'production' : undefined;
  if (!path) throw new Error('path must be production or oracle.');
  const shoes = input.shoes === undefined ? undefined : requireCount(input.shoes, 'shoes');
  const rounds = input.rounds === undefined ? undefined : requireCount(input.rounds, 'rounds');
  if ((shoes === undefined) === (rounds === undefined)) throw new Error('Provide exactly one of shoes or rounds.');
  const rawHands = input.activeHands;
  if (!Array.isArray(rawHands) || rawHands.length === 0 || rawHands.some((count) => !Number.isSafeInteger(count) || count < 1 || count > 3)) {
    throw new Error('activeHands must contain one, two, or three hand counts.');
  }
  const rawCut = input.cutRange;
  if (!rawCut || typeof rawCut !== 'object') throw new Error('cutRange is required.');
  const cut = rawCut as Record<string, unknown>;
  const minimum = requireCount(cut.minimum, 'cutRange.minimum');
  const maximum = requireCount(cut.maximum, 'cutRange.maximum');
  if (minimum > maximum || maximum >= beatTheHouseRules.cardsPerShoe) throw new Error('cutRange must be an increasing range within the shoe.');
  if (
    path === 'production' &&
    !input.analysisOnly &&
    (minimum !== beatTheHouseRules.cutThreshold.minimum || maximum !== beatTheHouseRules.cutThreshold.maximum)
  ) {
    throw new Error('The production path requires the approved cut range unless analysisOnly is true.');
  }
  const rawRatios = input.sideBetRatios;
  if (!rawRatios || typeof rawRatios !== 'object') throw new Error('sideBetRatios is required.');
  const sideBetRatios = Object.fromEntries(sideBetNames.map((name) => [name, parseRatio(String((rawRatios as Record<string, unknown>)[name]))])) as Record<
    SideBet,
    Ratio
  >;
  const strategy =
    input.strategy === 'match-push' || input.strategy === 'oracle-optimal' ? input.strategy : input.strategy === 'simple' ? input.strategy : undefined;
  if (!strategy || (strategy === 'oracle-optimal' && path !== 'oracle')) throw new Error('Invalid strategy for analysis path.');
  const table = input.strategyTable;
  if (!table || typeof table !== 'object') throw new Error('strategyTable is required.');
  const strategyTable = {
    oneCardHitThrough: Number((table as Record<string, unknown>).oneCardHitThrough),
    twoCardHitThrough: Number((table as Record<string, unknown>).twoCardHitThrough),
    threeCardHitThrough: Number((table as Record<string, unknown>).threeCardHitThrough),
  };
  if (Object.values(strategyTable).some((value) => !Number.isSafeInteger(value) || value < 2 || value > 14))
    throw new Error('strategyTable values must be safe card-rank integers.');
  const rawProfiles = input.sideBetProfiles;
  if (!Array.isArray(rawProfiles) || rawProfiles.length !== 16) throw new Error('sideBetProfiles must contain all 16 profiles.');
  const sideBetProfiles = rawProfiles.map((profile) => {
    if (
      !profile ||
      typeof profile !== 'object' ||
      typeof (profile as Record<string, unknown>).name !== 'string' ||
      !Array.isArray((profile as Record<string, unknown>).sideBets)
    ) {
      throw new Error('Invalid side-bet profile.');
    }
    const sideBets = (profile as Record<string, unknown>).sideBets as unknown[];
    if (sideBets.some((sideBet) => !sideBetNames.includes(sideBet as SideBet))) throw new Error('Invalid side-bet type.');
    return { name: profile.name, sideBets: sideBets as SideBet[] };
  });
  const rawSweep = input.matchPushRatios;
  if (!Array.isArray(rawSweep) || rawSweep.length === 0) throw new Error('matchPushRatios must be a non-empty ratio array.');
  const countConfig = shoes === undefined ? { rounds: rounds as number } : { shoes };
  return {
    configurationId: input.configurationId,
    seed,
    path,
    ...countConfig,
    activeHands: rawHands as number[],
    cutRange: { minimum, maximum },
    analysisOnly: input.analysisOnly === true,
    sideBetProfiles,
    sideBetRatios,
    strategy,
    strategyTable,
    matchPushRatios: rawSweep.map((ratio) => parseRatio(String(ratio))),
  };
};

export const loadConfig = (path: string): AnalysisConfig => parseConfig(JSON.parse(readFileSync(path, 'utf8')));

export const parseArguments = (argumentsList: readonly string[]): { readonly config: string; readonly format: AnalysisFormat } => {
  const configIndex = argumentsList.indexOf('--config');
  const config = configIndex >= 0 ? argumentsList[configIndex + 1] : undefined;
  const formatIndex = argumentsList.indexOf('--format');
  const format = argumentsList[formatIndex + 1] as AnalysisFormat | undefined;
  if (!config || (format !== 'json' && format !== 'markdown')) throw new Error('Usage: --config <file> --format json|markdown');
  return { config, format };
};
