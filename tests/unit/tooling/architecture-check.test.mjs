import { describe, expect, it } from 'vitest';
import { RuleTester } from 'eslint';

import { finiteNumberErrors } from '../../../scripts/finite-number-check.mjs';
import { magicNumberErrors } from '../../../scripts/magic-number-check.mjs';
import requireZodRecordKeyValue from '../../../scripts/require-zod-record-key-value.mjs';
import { mathRandomErrors } from '../../../scripts/math-random-check.mjs';
import { topLevelElementErrors } from '../../../scripts/top-level-elements-check.mjs';
import { zodObjectErrors } from '../../../scripts/zod-object-check.mjs';

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

  it('accepts anonymous declarations and let or var declarations', () => {
    expect(topLevelElementErrors('src/ui/Example.tsx', 'export default class {}')).toEqual([]);
    expect(topLevelElementErrors('src/game/example.ts', 'export default function () { return 1; }')).toEqual([]);
    expect(topLevelElementErrors('src/game/example.ts', 'let score = 1;')).toEqual([]);
    expect(topLevelElementErrors('src/game/example.ts', 'var score = 1;')).toEqual([]);
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

describe('magicNumberErrors', () => {
  it('rejects unexplained executable numeric literals in source files', () => {
    expect(
      magicNumberErrors(
        'src/game/example.ts',
        `
export function isBust(total: number): boolean {
  return total > 21;
}
`,
      ),
    ).toEqual([
      'src/game/example.ts:3:18 uses unexplained numeric literal 21. Name the value with a domain constant/config/fixture, or add "casino-magic-number-allow: <reason>" for an intentional inline exception.',
    ]);
  });

  it('accepts named constants, config values, and documented inline exceptions', () => {
    expect(
      magicNumberErrors(
        'src/game/example.ts',
        `
const blackjackTargetTotal = 21;
const layoutConfig = { tagOffsetY: 14 };

export function isBust(total: number): boolean {
  return total > blackjackTargetTotal || total > 50; // casino-magic-number-allow: legacy payout table threshold
}
`,
      ),
    ).toEqual([]);
  });

  it('covers tests while allowing literal test-case data inside test callbacks', () => {
    expect(
      magicNumberErrors(
        'tests/unit/game/example.test.ts',
        `
function helper(value: number): boolean {
  return value > 99;
}

it('asserts a domain example', () => {
  expect(helper(125)).toBe(true);
});
`,
      ),
    ).toEqual([
      'tests/unit/game/example.test.ts:3:18 uses unexplained numeric literal 99. Name the value with a domain constant/config/fixture, or add "casino-magic-number-allow: <reason>" for an intentional inline exception.',
    ]);
  });

  it('checks repository scripts too', () => {
    expect(
      magicNumberErrors(
        'scripts/example.mjs',
        `
export function timeoutMs(seconds) {
  return seconds * 1000;
}
`,
      ),
    ).toEqual([
      'scripts/example.mjs:3:20 uses unexplained numeric literal 1000. Name the value with a domain constant/config/fixture, or add "casino-magic-number-allow: <reason>" for an intentional inline exception.',
    ]);
  });
});

describe('zodObjectErrors', () => {
  it('rejects z.object calls without a strict chain', () => {
    expect(zodObjectErrors('src/schemas/example.ts', 'const schema = z.object({ value: z.string() });')).toEqual([
      'src/schemas/example.ts:1:16 calls z.object without .strict(). Add .strict() to reject unrecognised keys.',
    ]);
  });

  it('accepts multiline strict chains and ignores unrelated object text', () => {
    expect(
      zodObjectErrors(
        'src/schemas/example.ts',
        `
const plainObject = { value: 'text' };
const schema = z
  .object({ value: z.string() })
  .strict()
  .optional();
`,
      ),
    ).toEqual([]);
  });

  it('checks TSX files and rejects incomplete strict chains', () => {
    expect(zodObjectErrors('scripts/example.mjs', 'z.object({ value: 1 });')).toEqual([]);
    expect(
      zodObjectErrors(
        'tests/unit/tooling/example.tsx',
        `
const plain = object({ value: 'text' });
const other = otherNamespace.object({ value: 'text' });
const extended = z.object({ value: z.string() }).extend({ label: z.string() });
const property = z.object({ value: z.string() }).strict;
const chainedProperty = z.object({ value: z.string() }).strict.call(null);
`,
      ),
    ).toHaveLength(3);
  });
});

describe('finiteNumberErrors', () => {
  it('rejects direct finite-number declarations outside the shared primitive', () => {
    expect(finiteNumberErrors('src/schemas/example.ts', 'const schema = z.number().finite().int();')).toEqual([
      'src/schemas/example.ts:1:16 uses z.number().finite() directly. Import finiteNumberSchema from src/schemas/casinoSchemas/finiteNumberSchema instead.',
    ]);
  });

  it('allows the shared primitive, coercing schemas, and custom finite errors', () => {
    expect(finiteNumberErrors('src/schemas/casinoSchemas/finiteNumberSchema.ts', 'export const schema = z.number().finite();')).toEqual([]);
    expect(
      finiteNumberErrors(
        'tests/unit/schemas/example.tsx',
        `
const coerced = z.coerce.number().finite();
const custom = z.number().finite('Amount must be finite.');
`,
      ),
    ).toEqual([]);
  });
});

describe('requireZodRecordKeyValue', () => {
  const ruleTester = new RuleTester();
  ruleTester.run('require-zod-record-key-value', requireZodRecordKeyValue, {
    valid: ['z.record(z.string(), z.number());', 'other.record(z.number());'],
    invalid: [
      {
        code: 'z.record(z.number());',
        errors: [{ messageId: 'missingKeyValueSchemas' }],
      },
      {
        code: 'z.record();',
        errors: [{ messageId: 'missingKeyValueSchemas' }],
      },
    ],
  });
});
