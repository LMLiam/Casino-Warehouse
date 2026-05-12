import { describe, expect, it } from 'vitest';

import { dependabotActionsUpdateFailures, dependencyReviewPolicyFailures, workflowActionPinFailures } from '../../../scripts/supply-chain-check.mjs';

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

describe('workflowActionPinFailures', () => {
  it('accepts full-SHA external actions with version comments', () => {
    const failures = workflowActionPinFailures([
      {
        path: '.github/workflows/example.yml',
        source: `
steps:
  - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5
  - uses: './.github/actions/local-action'
`,
      },
    ]);

    expect(failures).toEqual([]);
  });

  it('rejects external actions without explicit SHA pins and version comments', () => {
    const failures = workflowActionPinFailures([
      {
        path: '.github/workflows/example.yml',
        source: `
steps:
  - uses: actions/checkout
  - uses: actions/setup-node@v5
  - uses: ossf/scorecard-action@4eaacf0543bb3f2c246792bd56e8cdeffafb205a
`,
      },
    ]);

    expect(failures).toEqual([
      '.github/workflows/example.yml:3 uses actions/checkout without an explicit ref.',
      '.github/workflows/example.yml:4 uses actions/setup-node@v5. Pin external actions to a full 40-character commit SHA.',
      '.github/workflows/example.yml:4 must keep a same-line version comment for Dependabot, for example "# v1.2.3".',
      '.github/workflows/example.yml:5 must keep a same-line version comment for Dependabot, for example "# v1.2.3".',
    ]);
  });
});

describe('dependencyReviewPolicyFailures', () => {
  it('accepts the configured Dependency Review severity and scope policy', () => {
    expect(
      dependencyReviewPolicyFailures(`with:
  fail-on-severity: moderate
  fail-on-scopes: runtime,development,unknown
`),
    ).toEqual([]);
  });

  it('requires both Dependency Review policy fragments', () => {
    expect(dependencyReviewPolicyFailures('with:\n  fail-on-severity: high\n')).toEqual([
      '.github/workflows/dependency-review.yml must include "fail-on-severity: moderate".',
      '.github/workflows/dependency-review.yml must include "fail-on-scopes: runtime,development,unknown".',
    ]);
  });
});
