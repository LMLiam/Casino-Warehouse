import { describe, expect, it } from 'vitest';
import { buildE2eMatrix } from '../../../scripts/ci-e2e-matrix.mjs';

const baseLane = { id: 'sample-lane', label: 'Sample Lane', project: 'laptop', suites: ['casino-visual.spec.ts'], shards: 1 };

describe('ci e2e matrix builder', () => {
  it('expands the committed lanes into the documented matrix entries', () => {
    const matrix = buildE2eMatrix();

    expect(matrix.map((entry) => entry.name)).toEqual(['laptop-visual', 'tablet-visual', 'laptop-multiplayer-1', 'laptop-multiplayer-2']);
    expect(matrix[0]).toEqual({
      name: 'laptop-visual',
      label: 'Laptop Visual',
      playwrightArgs: '--workers=1 --project=laptop tests/e2e/casino-visual.spec.ts',
    });
    expect(matrix[3]).toEqual({
      name: 'laptop-multiplayer-2',
      label: 'Laptop Multiplayer 2/2',
      playwrightArgs: '--workers=1 --project=laptop --shard=2/2 tests/e2e/multiplayer-flow.spec.ts tests/e2e/public-tunnel-smoke.spec.ts',
    });
  });

  it('generates shard names and fractions when a lane fans out', () => {
    const matrix = buildE2eMatrix([{ ...baseLane, id: 'multiplayer', label: 'Multiplayer', shards: 3 }]);

    expect(matrix.map((entry) => entry.name)).toEqual(['multiplayer-1', 'multiplayer-2', 'multiplayer-3']);
    expect(matrix.map((entry) => entry.label)).toEqual(['Multiplayer 1/3', 'Multiplayer 2/3', 'Multiplayer 3/3']);
    expect(matrix[1].playwrightArgs).toContain('--shard=2/3');
  });

  it('omits shard decorations for single-shard lanes', () => {
    const matrix = buildE2eMatrix([baseLane]);

    expect(matrix[0].name).toBe('sample-lane');
    expect(matrix[0].playwrightArgs).not.toContain('--shard=');
  });

  it('rejects lanes referencing missing suite files', () => {
    expect(() => buildE2eMatrix([{ ...baseLane, suites: ['ghost-suite.spec.ts'] }])).toThrowError(/ghost-suite\.spec\.ts/);
  });

  it('rejects duplicate lane ids and invalid shard counts', () => {
    expect(() => buildE2eMatrix([baseLane, { ...baseLane, label: 'Other Lane' }])).toThrowError(/duplicated/);
    expect(() => buildE2eMatrix([{ ...baseLane, id: 'zero-shards', shards: 0 }])).toThrowError(/integer shard count/);
    expect(() => buildE2eMatrix([{ ...baseLane, id: 'no-suites', suites: [] }])).toThrowError(/at least one suite/);
  });
});
