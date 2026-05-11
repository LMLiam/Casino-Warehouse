import { describe, expect, it } from 'vitest';

import { validatePullRequest } from '../../../scripts/validate-pr-standards.mjs';

const validBody = `## Summary

Adds a reusable PR metadata gate so maintainers can enforce review standards before merge.

## Type

- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Refactor
- [x] Test or tooling

## Checks

- [x] I read \`CONTRIBUTING.md\`.
- [x] I kept generated build output out of this pull request.
- [x] I added or updated tests, or explained why tests are not needed.
- [x] I ran the relevant local checks.

## Testing

Commands run:

\`\`\`text
npm test -- tests/unit/tooling/validate-pr-standards.test.mjs
\`\`\`

## Notes

N/A`;

function pullRequest(overrides = {}) {
  return {
    title: 'ci(standards): enforce pull request metadata',
    labels: [{ name: 'type:maintenance' }, { name: 'area:tooling' }],
    body: validBody,
    ...overrides,
  };
}

describe('validatePullRequest', () => {
  it('accepts a pull request that follows the repository standards', () => {
    expect(validatePullRequest(pullRequest())).toEqual([]);
  });

  it('requires a conventional pull request title', () => {
    const failures = validatePullRequest(pullRequest({ title: 'Add a validator' }));

    expect(failures).toContain('PR title must match "type(scope): summary" using one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, security, deps.');
  });

  it('requires type and area labels', () => {
    const failures = validatePullRequest(pullRequest({ labels: [{ name: 'dependencies' }] }));

    expect(failures).toContain('Add one type label, for example "type:feature" or "type:maintenance".');
    expect(failures).toContain('Add one area label, for example "area:ui", "area:gameplay", or "area:tooling".');
  });

  it('requires the filled-out PR template sections', () => {
    const failures = validatePullRequest(
      pullRequest({
        body: validBody
          .replace('- [x] I ran the relevant local checks.', '- [ ] I ran the relevant local checks.')
          .replace('npm test -- tests/unit/tooling/validate-pr-standards.test.mjs', ''),
      }),
    );

    expect(failures).toContain('Complete the required check: "I ran the relevant local checks."');
    expect(failures).toContain('Testing must include a non-empty "Commands run" fenced block.');
  });

  it('rejects body placeholders from the PR template', () => {
    const failures = validatePullRequest(
      pullRequest({
        body: validBody.replace('Adds a reusable PR metadata gate so maintainers can enforce review standards before merge.', 'Describe the change and why it is needed.'),
      }),
    );

    expect(failures).toContain('Replace the template placeholder: "Describe the change and why it is needed."');
  });
});
