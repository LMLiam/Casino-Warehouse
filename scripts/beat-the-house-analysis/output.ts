import type { AnalysisConfig } from './config';
import { ratioToString } from './config';
import type { ProfileResult } from './simulate';

export type AnalysisOutput = {
  readonly result: {
    readonly configurationId: string;
    readonly rulesetId: 'beat-the-house-six-deck';
    readonly seed: number;
    readonly path: string;
    readonly profiles: readonly ProfileResult[];
    readonly matchPushPolicy: readonly { readonly ratio: string; readonly action: string }[];
  };
  readonly execution: { readonly runtimeMs: number };
};

export const createOutput = (config: AnalysisConfig, profiles: readonly ProfileResult[], runtimeMs: number): AnalysisOutput => ({
  result: {
    configurationId: config.configurationId,
    rulesetId: 'beat-the-house-six-deck',
    seed: config.seed,
    path: config.path,
    profiles,
    matchPushPolicy: config.matchPushRatios.map((ratio) => ({
      ratio: ratioToString(ratio),
      action: ratio.numerator * 2 >= ratio.denominator ? 'stick' : 'hit',
    })),
  },
  execution: { runtimeMs },
});

export const formatOutput = (output: AnalysisOutput, format: 'json' | 'markdown'): string =>
  format === 'json'
    ? JSON.stringify(output, null, 2)
    : [
        `# Beat the House Analysis`,
        ``,
        `- Seed: ${output.result.seed}`,
        `- Path: ${output.result.path}`,
        `- Profiles: ${output.result.profiles.length}`,
        `- Match Push policy points: ${output.result.matchPushPolicy.length}`,
        `- Runtime: ${output.execution.runtimeMs} ms`,
        ``,
        ...output.result.profiles.map(
          (profile) =>
            `- ${profile.activeHands} hands, ${profile.name}: returned ${profile.statistics.meanReturned.toFixed(6)}, profit ${profile.statistics.meanProfit.toFixed(6)}, shoes ${profile.statistics.sampleSize}`,
        ),
      ].join('\n');
