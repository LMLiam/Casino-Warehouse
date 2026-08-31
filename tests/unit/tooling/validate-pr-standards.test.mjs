import { describe, expect, it } from 'vitest';

import { validateCommitMessage, validatePullRequest } from '../../../scripts/validate-pr-standards.mjs';

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

  it('accepts Dependabot pull requests with repository labels without enforcing human template fields', () => {
    expect(
      validatePullRequest(
        pullRequest({
          title: 'Bump ws from 8.20.1 to 8.21.0',
          body: 'Bumps ws from 8.20.1 to 8.21.0.',
          user: { login: 'dependabot[bot]' },
        }),
      ),
    ).toEqual([]);
  });

  it('still requires repository labels on Dependabot pull requests', () => {
    expect(
      validatePullRequest({
        title: 'Bump ws from 8.20.1 to 8.21.0',
        labels: [],
        body: 'Bumps ws from 8.20.1 to 8.21.0.',
        user: { login: 'dependabot[bot]' },
      }),
    ).toEqual([
      'Add one type label, for example "type:feature" or "type:maintenance".',
      'Add one area label, for example "area:ui", "area:gameplay", or "area:tooling".',
    ]);
  });

  it('requires a conventional pull request title', () => {
    const failures = validatePullRequest(pullRequest({ title: 'Add a validator' }));

    expect(failures).toContain(
      'PR title must match "type(scope): summary" using one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, security, deps.',
    );
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

  it('reports missing template sections and empty metadata', () => {
    const failures = validatePullRequest({
      body: '## Summary\n\nToo short.',
      labels: undefined,
      title: undefined,
    });

    expect(failures).toContain(
      'PR title must match "type(scope): summary" using one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, security, deps.',
    );
    expect(failures).toContain('Add one type label, for example "type:feature" or "type:maintenance".');
    expect(failures).toContain('Add one area label, for example "area:ui", "area:gameplay", or "area:tooling".');
    expect(failures).toContain('PR body must keep the "## Type" template section.');
    expect(failures).toContain('PR body must keep the "## Checks" template section.');
    expect(failures).toContain('PR body must keep the "## Testing" template section.');
    expect(failures).toContain('PR body must keep the "## Notes" template section.');
  });

  it('requires a useful summary and one selected type checkbox', () => {
    const failures = validatePullRequest(
      pullRequest({
        body: validBody
          .replace('Adds a reusable PR metadata gate so maintainers can enforce review standards before merge.', 'Too short.')
          .replace('- [x] Test or tooling', '- [ ] Test or tooling'),
      }),
    );

    expect(failures).toContain('The Summary section must describe the change and why it is needed.');
    expect(failures).toContain('Select at least one checkbox in the Type section.');
  });

  it('rejects body placeholders from the PR template', () => {
    const failures = validatePullRequest(
      pullRequest({
        body: validBody.replace(
          'Adds a reusable PR metadata gate so maintainers can enforce review standards before merge.',
          'Describe the change and why it is needed.',
        ),
      }),
    );

    expect(failures).toContain('Replace the template placeholder: "Describe the change and why it is needed."');
  });
});

describe('validateCommitMessage', () => {
  it('accepts a conventional commit message', () => {
    expect(validateCommitMessage('chore(tooling): add commit message checks\n\nDetails follow.')).toEqual([]);
  });

  it('rejects an ad-hoc commit without a summary', () => {
    expect(validateCommitMessage('feat(ui)')).toEqual([
      'Commit message must match "type(scope): summary" using one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, security, deps.',
    ]);
  });
});
