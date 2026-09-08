import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type AnalysisConfig, loadConfig, parseConfig } from '../../../scripts/beat-the-house-analysis/config';
import { type AnalysisOutput } from '../../../scripts/beat-the-house-analysis/output';
import { type MetricStatistics, type ProfileMetrics, type ProfileResult, simulate } from '../../../scripts/beat-the-house-analysis/simulate';
import { handIds } from '../../../src/game/types/handIds';
import type { SideBet } from '../../../scripts/beat-the-house-analysis/config';

const canonicalConfigPath = 'scripts/beat-the-house-analysis/canonical-config.json';
const canonicalResultsPath = 'scripts/beat-the-house-analysis/canonical-results.json';
const canonicalConfig = loadConfig(canonicalConfigPath);
const ciSampleShoes = 20;
const ciSeedBase = 90210;
const sigmaAllowance = { name: 'four-standard-errors', value: 4, reason: 'The canonical and CI runs are independent two-shoe samples.' } as const;
const numericalTolerance = { value: 1e-12, reason: 'Allow binary floating-point normalisation at the comparison boundary.' } as const;

type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

const record = (value: JsonValue | undefined): { readonly [key: string]: JsonValue } => {
  if (value === null || Array.isArray(value) || Object(value) !== value) throw new Error('Expected a record.');
  return value as { readonly [key: string]: JsonValue };
};

const numberValue = (value: JsonValue | undefined, name: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
};

const validateMetric = (value: JsonValue | undefined, label: string): void => {
  const metric = record(value);
  if (metric.observationUnit !== 'shoe' || typeof metric.denominator !== 'string') throw new Error(`${label} has an invalid metric contract.`);
  const statistics = record(metric.statistics);
  for (const name of ['meanReturned', 'meanProfit', 'standardDeviation', 'standardError']) {
    if (statistics[name] !== null) numberValue(statistics[name], `${label}.${name}`);
  }
  for (const name of ['sampleSize', 'totalRounds', 'totalHands']) {
    if (!Number.isSafeInteger(statistics[name]) || Number(statistics[name]) < 0) throw new Error(`${label}.${name} must be a non-negative integer.`);
  }
  if (Number(statistics.sampleSize) < 2 || statistics.standardDeviation === null || statistics.standardError === null)
    throw new Error(`${label} must contain at least two independent shoe observations.`);
};

const validateArtifact = (value: JsonValue): AnalysisOutput => {
  const result = record(record(value).result);
  if (result.rulesetId !== 'beat-the-house-six-deck' || result.configurationId !== canonicalConfig.configurationId)
    throw new Error('Canonical identity does not match.');
  if (result.seed !== canonicalConfig.seed || result.path !== 'production') throw new Error('Canonical run identity does not match.');
  if (!Array.isArray(result.profiles) || result.profiles.length !== canonicalConfig.activeHands.length * canonicalConfig.sideBetProfiles.length)
    throw new Error('Canonical profile count is invalid.');
  const expectedProfiles = canonicalConfig.activeHands.flatMap((activeHands) =>
    canonicalConfig.sideBetProfiles.map((profile) => `${activeHands}:${profile.name}`),
  );
  const rawProfiles = result.profiles as readonly JsonValue[];
  const profiles = result.profiles as readonly ProfileResult[];
  const actualProfiles = profiles.map((profile) => `${profile.activeHands}:${profile.name}`);
  if (JSON.stringify(actualProfiles) !== JSON.stringify(expectedProfiles)) throw new Error('Canonical profile order is invalid.');
  for (const profileValue of rawProfiles) {
    const profile = record(profileValue);
    if (
      !Array.isArray(profile.sideBets) ||
      typeof profile.strategy !== 'string' ||
      !record(profile.sideBetRatios) ||
      !record(profile.strategyTable) ||
      !Array.isArray(profile.assertedMetrics)
    )
      throw new Error('Canonical profile configuration is invalid.');
    const metrics = record(profile.metrics);
    for (const name of ['returnedPerTotalStake', 'profitPerTotalStake', 'mainReturnedPerMainStake', 'mainProfitPerMainStake'])
      validateMetric(metrics[name], `${profile.name}.${name}`);
    for (const sideBet of profile.sideBets as SideBet[]) {
      const sideMetrics = record(record(metrics.sideBets)[sideBet]);
      validateMetric(sideMetrics.returnedPerSideStake, `${profile.name}.${sideBet}.returned`);
      validateMetric(sideMetrics.profitPerSideStake, `${profile.name}.${sideBet}.profit`);
    }
    for (const handId of profile.activeHands === 1 ? ['left'] : profile.activeHands === 2 ? ['left', 'centre'] : handIds) {
      const seatMetrics = record(record(metrics.seats)[handId]);
      validateMetric(seatMetrics.returnedPerSeatStake, `${profile.name}.${handId}.returned`);
      validateMetric(seatMetrics.profitPerSeatStake, `${profile.name}.${handId}.profit`);
    }
    if (profile.assertedMetrics.length === 0) throw new Error(`${profile.name} metric assertion list is empty.`);
    for (const forbidden of ['shoeOrder', 'cards', 'hiddenCard', 'cutThreshold'])
      if (forbidden in profile) throw new Error(`Canonical profile exposes ${forbidden}.`);
  }
  return value as AnalysisOutput;
};

const metricEntries = (metrics: ProfileMetrics): readonly (readonly [string, MetricStatistics])[] => [
  ['returnedPerTotalStake', metrics.returnedPerTotalStake],
  ['profitPerTotalStake', metrics.profitPerTotalStake],
  ['mainReturnedPerMainStake', metrics.mainReturnedPerMainStake],
  ['mainProfitPerMainStake', metrics.mainProfitPerMainStake],
  ...Object.entries(metrics.sideBets).flatMap(
    ([sideBet, values]) =>
      [
        [`${sideBet}.returnedPerSideStake`, values.returnedPerSideStake],
        [`${sideBet}.profitPerSideStake`, values.profitPerSideStake],
      ] as const,
  ),
  ...Object.entries(metrics.seats).flatMap(
    ([handId, values]) =>
      [
        [`${handId}.returnedPerSeatStake`, values.returnedPerSeatStake],
        [`${handId}.profitPerSeatStake`, values.profitPerSeatStake],
      ] as const,
  ),
];

const profileLabel = (profile: { activeHands: number; name: string; strategy: string }, metricName: string): string =>
  `${profile.name}, ${profile.activeHands} hands, ${profile.strategy}, metric ${metricName}`;

const ciConfigFor = (activeHands: number): AnalysisConfig =>
  parseConfig({
    ...canonicalConfig,
    configurationId: `${canonicalConfig.configurationId}-ci`,
    seed: ciSeedBase + activeHands * 1_000,
    shoes: ciSampleShoes,
    rounds: undefined,
    activeHands: [activeHands],
    sideBetRatios: Object.fromEntries(
      Object.entries(canonicalConfig.sideBetRatios).map(([sideBet, ratio]) => [sideBet, `${ratio.numerator}/${ratio.denominator}`]),
    ),
    matchPushRatios: canonicalConfig.matchPushRatios.map((ratio) => `${ratio.numerator}/${ratio.denominator}`),
  });

describe('Beat the House six-deck RTP guardrails', () => {
  it('validates the canonical artifact contract and configuration identity', () => {
    const canonicalValue: JsonValue = JSON.parse(readFileSync(canonicalResultsPath, 'utf8'));
    validateArtifact(canonicalValue);
  });

  it('compares every canonical metric with independent persistent-shoe CI samples', () => {
    const canonicalValue: JsonValue = JSON.parse(readFileSync(canonicalResultsPath, 'utf8'));
    const canonical = validateArtifact(canonicalValue);
    for (const activeHands of canonicalConfig.activeHands) {
      const observed = simulate(ciConfigFor(activeHands));
      const expected = canonical.result.profiles.filter((profile) => profile.activeHands === activeHands);
      expect(observed).toHaveLength(expected.length);
      for (const [index, profile] of observed.entries()) {
        const canonicalProfile = expected[index];
        if (!canonicalProfile) throw new Error(`Missing canonical profile ${profileLabel(profile, 'profile')}.`);
        expect(`${profile.activeHands}:${profile.name}`).toBe(`${canonicalProfile.activeHands}:${canonicalProfile.name}`);
        expect(profile.sideBets).toEqual(canonicalProfile.sideBets);
        expect(profile.strategy).toBe(canonicalProfile.strategy);
        expect(profile.sideBetRatios).toEqual(canonicalProfile.sideBetRatios);
        expect(profile.strategyTable).toEqual(canonicalProfile.strategyTable);
        expect(profile.assertedMetrics).toEqual(canonicalProfile.assertedMetrics);
        for (const [metricName, metric] of metricEntries(profile.metrics)) {
          const canonicalMetric = metricEntries(canonicalProfile.metrics).find(([name]) => name === metricName)?.[1];
          if (!canonicalMetric) throw new Error(`Missing canonical metric ${profileLabel(profile, metricName)}.`);
          const canonicalStatistics = canonicalMetric.statistics;
          const ciStatistics = metric.statistics;
          expect(metric.denominator, profileLabel(profile, metricName)).toBe(canonicalMetric.denominator);
          expect(metric.observationUnit, profileLabel(profile, metricName)).toBe('shoe');
          if (canonicalStatistics.standardDeviation === null || ciStatistics.standardDeviation === null)
            throw new Error('A guardrail metric has no deviation.');
          const differenceStandardError = Math.hypot(
            canonicalStatistics.standardDeviation / Math.sqrt(canonicalStatistics.sampleSize),
            ciStatistics.standardDeviation / Math.sqrt(ciStatistics.sampleSize),
          );
          const tolerance = Math.max(sigmaAllowance.value * differenceStandardError, numericalTolerance.value);
          expect(Math.abs(canonicalStatistics.meanReturned - ciStatistics.meanReturned), profileLabel(profile, metricName)).toBeLessThanOrEqual(tolerance);
        }
      }
    }
  }, 60_000);
});
