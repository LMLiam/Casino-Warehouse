import { describe, expect, it } from 'vitest';

import { topLevelElementErrors } from '../../../scripts/top-level-elements-check.mjs';

describe('topLevelElementErrors', () => {
  it('accepts a file with one exported top-level element and private helpers', () => {
    expect(
      topLevelElementErrors(
        'src/game/example.ts',
        `
const privateScale = 2;

export const scoreTotal = (value: number): number => value * privateScale;
`,
      ),
    ).toEqual([]);
  });

  it('accepts the supported single exported declaration shapes', () => {
    expect(topLevelElementErrors('src/ui/Example.tsx', 'export default class Example {}')).toEqual([]);
    expect(topLevelElementErrors('src/game/example.ts', 'export default function example() { return 1; }')).toEqual([]);
    expect(topLevelElementErrors('src/game/Phase.ts', "export enum Phase { Betting = 'betting' }")).toEqual([]);
    expect(topLevelElementErrors('src/game/ignored.ts', '')).toEqual([]);
  });

  it('rejects multiple exported top-level elements', () => {
    const errors = topLevelElementErrors(
      'src/game/example.ts',
      `
export interface ScoreInput {
  readonly value: number;
}

export const scoreTotal = (input: ScoreInput): number => input.value;
`,
    );

    expect(errors).toEqual(['src/game/example.ts exports 2 top-level elements (ScoreInput, scoreTotal). Keep one primary exported element per file.']);
  });

  it('rejects re-export-only files', () => {
    expect(
      topLevelElementErrors(
        'src/game/index.ts',
        `
export { scoreTotal } from './scoreTotal';
export type { ScoreInput } from './ScoreInput';
`,
      ),
    ).toEqual(['src/game/index.ts only re-exports declarations from other modules. Import focused module files directly instead.']);
  });

  it('rejects pure type aggregation files with multiple exported declarations', () => {
    expect(
      topLevelElementErrors(
        'src/game/gameTypes.ts',
        `
export interface ScoreInput {
  readonly value: number;
}

export type ScorePhase = 'idle' | 'settled';
`,
      ),
    ).toEqual(['src/game/gameTypes.ts exports 2 top-level elements (ScoreInput, ScorePhase). Keep one primary exported element per file.']);
  });
});
