import { describe, expect, it } from 'vitest';

import { mathRandomErrors } from '../../../scripts/math-random-check.mjs';
import { topLevelElementErrors } from '../../../scripts/top-level-elements-check.mjs';

describe('topLevelElementErrors', () => {
  it('rejects a file with one exported top-level element and a private helper', () => {
    expect(
      topLevelElementErrors(
        'src/game/example.ts',
        `
const privateScale = 2;

export const scoreTotal = (value: number): number => value * privateScale;
`,
      ),
    ).toEqual(['src/game/example.ts declares 2 top-level elements (privateScale, scoreTotal). Keep one module-scope element per file.']);
  });

  it('accepts the supported single exported declaration shapes', () => {
    expect(topLevelElementErrors('src/ui/Example.tsx', 'export default class Example {}')).toEqual([]);
    expect(topLevelElementErrors('src/game/example.ts', 'export default function example() { return 1; }')).toEqual([]);
    expect(topLevelElementErrors('src/game/Phase.ts', "export enum Phase { Betting = 'betting' }")).toEqual([]);
    expect(topLevelElementErrors('src/game/ignored.ts', '')).toEqual([]);
  });

  it('rejects multiple top-level elements', () => {
    const errors = topLevelElementErrors(
      'src/game/example.ts',
      `
export interface ScoreInput {
  readonly value: number;
}

export const scoreTotal = (input: ScoreInput): number => input.value;
`,
    );

    expect(errors).toEqual(['src/game/example.ts declares 2 top-level elements (ScoreInput, scoreTotal). Keep one module-scope element per file.']);
  });

  it.each([
    ['interface', 'interface ScoreInput { readonly value: number; }'],
    ['type', 'type ScoreInput = { readonly value: number; };'],
    ['class', 'class ScoreInput { readonly value = 1; }'],
    ['function', 'function scoreInput(): number { return 1; }'],
    ['constant', 'const scoreInput = 1;'],
  ])('rejects an unexported top-level %s with another top-level element', (_, declaration) => {
    const errors = topLevelElementErrors(
      'src/game/example.ts',
      `
${declaration}

export const scoreTotal = 2;
`,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('src/game/example.ts declares 2 top-level elements');
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
    ).toEqual(['src/game/gameTypes.ts declares 2 top-level elements (ScoreInput, ScorePhase). Keep one module-scope element per file.']);
  });
});

describe('mathRandomErrors', () => {
  it('rejects direct Math.random calls in non-visual source modules', () => {
    expect(mathRandomErrors('src/state/profiles/createProfile.ts', 'const id = Math.random().toString(36);')).toEqual([
      'src/state/profiles/createProfile.ts calls Math.random directly. Use an injected RNG, secure random helper, or keep visual-only randomness in an allowlisted renderer.',
    ]);
  });

  it('allows direct Math.random only in visual effect renderers', () => {
    expect(mathRandomErrors('src/ui/renderers/EffectRenderer.ts', 'const offset = Math.random() * 10;')).toEqual([]);
    expect(mathRandomErrors('src/state/profiles/createStateId.ts', 'const id = crypto.randomUUID();')).toEqual([]);
  });
});
