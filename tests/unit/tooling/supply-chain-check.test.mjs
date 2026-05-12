import { describe, expect, it } from 'vitest';

import { dependabotActionsUpdateFailures } from '../../../scripts/supply-chain-check.mjs';

const validDependabot = `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    labels:
      - dependencies
      - area:tooling
      - type:maintenance
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 2
    groups:
      github-actions:
        patterns:
          - '*'
    labels:
      - dependencies
      - area:tooling
      - security
      - type:maintenance
`;

describe('dependabotActionsUpdateFailures', () => {
  it('accepts the bounded GitHub Actions update block', () => {
    expect(dependabotActionsUpdateFailures(validDependabot)).toEqual([]);
  });

  it('validates settings inside the GitHub Actions block instead of the whole file', () => {
    const failures = dependabotActionsUpdateFailures(
      validDependabot
        .replace('interval: weekly\n    open-pull-requests-limit: 2', 'interval: monthly\n    open-pull-requests-limit: 9')
        .replace('directory: /\n    schedule:\n      interval: monthly', 'directory: /.github\n    schedule:\n      interval: monthly'),
    );

    expect(failures).toEqual([
      '.github/dependabot.yml github-actions update block must include "directory: /" for bounded GitHub Actions updates.',
      '.github/dependabot.yml github-actions update block must include "interval: weekly" for bounded GitHub Actions updates.',
      '.github/dependabot.yml github-actions update block must include "open-pull-requests-limit: 2" for bounded GitHub Actions updates.',
    ]);
  });

  it('requires a GitHub Actions group inside the GitHub Actions update block', () => {
    const failures = dependabotActionsUpdateFailures(validDependabot.replace("    groups:\n      github-actions:\n        patterns:\n          - '*'\n", ''));

    expect(failures).toEqual([
      '.github/dependabot.yml github-actions update block must include "groups:" for bounded GitHub Actions updates.',
      '.github/dependabot.yml github-actions update block must include a "github-actions:" group for bounded GitHub Actions updates.',
    ]);
  });

  it('requires the GitHub Actions update block to exist', () => {
    const failures = dependabotActionsUpdateFailures(validDependabot.replace('  - package-ecosystem: github-actions', '  - package-ecosystem: docker'));

    expect(failures).toEqual(['.github/dependabot.yml must include a github-actions update block for bounded GitHub Actions updates.']);
  });
});
