import { describe, expect, it } from 'vitest';

import {
  buildIssueStandardsComment,
  issueStandardsCommentMarker,
  upsertIssueStandardsComment,
  validateIssue,
} from '../../../scripts/validate-issue-standards.mjs';

const planningBody = `## Problem or opportunity

Issue metadata currently drifts after creation, especially when blank issues are opened or labels are edited.

## Proposed solution

Add a trusted workflow that validates titles, labels, status, milestones, and required body sections.

## Acceptance criteria

- The workflow comments with every failure.
- Valid issues stop showing stale failure guidance.`;

const bugBody = `## Summary

The blackjack table renders stale cards after reconnecting.

## Steps to reproduce

1. Create a Blackjack room.
2. Reload the browser.
3. Rejoin the room.

## Expected behaviour

The current table state renders after reconnect.

## Actual behaviour

The previous table state remains visible.`;

function issue(overrides = {}) {
  return {
    body: planningBody,
    labels: [{ name: 'type:maintenance' }, { name: 'area:tooling' }, { name: 'status:ready' }],
    milestone: { title: '01 - CI hardening' },
    number: 18,
    title: 'ci(issues): lint issue metadata in CI',
    ...overrides,
  };
}

describe('validateIssue', () => {
  it('accepts a ready planning issue with title, labels, milestone, and actionable body', () => {
    expect(validateIssue(issue())).toEqual([]);
  });

  it('does not require assignees, linked projects, or priority labels for ready issues', () => {
    expect(
      validateIssue(
        issue({
          assignees: [],
          labels: [{ name: 'type:maintenance' }, { name: 'area:tooling' }, { name: 'status:ready' }],
          projectCards: [],
        }),
      ),
    ).toEqual([]);
  });

  it('requires conventional issue titles and type, area, and status labels', () => {
    const failures = validateIssue(issue({ labels: [{ name: 'dependencies' }], title: 'Lint issue metadata' }));

    expect(failures).toContain(
      'Issue title must match "type(scope): summary" using one of: bug, feature, maintenance, docs, test, ci, security, deps, question.',
    );
    expect(failures).toContain('Add one type label, for example "type:bug", "type:feature", or "type:maintenance".');
    expect(failures).toContain('Add one area label, for example "area:ui", "area:gameplay", or "area:tooling".');
    expect(failures).toContain('Add one status label, for example "status:needs-triage" or "status:ready".');
  });

  it('requires meaningful planning sections instead of placeholders', () => {
    const failures = validateIssue(
      issue({
        body: `## Problem or opportunity

TODO

## Proposed solution

No response`,
      }),
    );

    expect(failures).toContain('Fill in the "## Problem or opportunity" section with concrete, non-placeholder detail.');
    expect(failures).toContain('Fill in the "## Proposed solution" section with concrete, non-placeholder detail.');
  });

  it('requires bug template sections for bug issues', () => {
    expect(
      validateIssue(
        issue({
          body: bugBody,
          labels: [{ name: 'type:bug' }, { name: 'area:gameplay' }, { name: 'status:needs-triage' }],
          title: 'bug(gameplay): reconnect shows stale blackjack cards',
        }),
      ),
    ).toEqual([]);

    const failures = validateIssue(
      issue({ body: '## Summary\n\nCards are stale.', labels: [{ name: 'type:bug' }], title: 'bug(gameplay): reconnect shows stale blackjack cards' }),
    );

    expect(failures).toContain('Bug issues must include a "## Steps to reproduce" section.');
    expect(failures).toContain('Bug issues must include a "## Expected behaviour" section.');
    expect(failures).toContain('Bug issues must include a "## Actual behaviour" section.');
  });

  it('requires milestone and actionable scope for ready issues', () => {
    const failures = validateIssue(
      issue({
        body: `## Problem or opportunity

The backlog needs a clearer issue workflow.

## Proposed solution

Discuss it.`,
        milestone: null,
      }),
    );

    expect(failures).toContain('Issues marked "status:ready" must be assigned to a milestone.');
    expect(failures).toContain('Issues marked "status:ready" must include a clear next action or acceptance criteria.');
  });
});

describe('issue standards comments', () => {
  it('builds marked failure and success comments', () => {
    expect(buildIssueStandardsComment(['Add one status label.'])).toContain(issueStandardsCommentMarker);
    expect(buildIssueStandardsComment(['Add one status label.'])).toContain('- Add one status label.');
    expect(buildIssueStandardsComment([])).toContain('Issue metadata passes');
  });

  it('creates, updates, and skips marker comments as appropriate', async () => {
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
      calls.push([options.method ?? 'GET', url, options.body ? JSON.parse(options.body) : undefined]);
      if ((options.method ?? 'GET') === 'GET') {
        return response([{ id: 7, body: `${issueStandardsCommentMarker}\nold guidance` }]);
      }
      return response({ id: 7 });
    };

    await expect(
      upsertIssueStandardsComment({ fetchImpl, repository: 'LMLiam/Casino-Warehouse', token: 'token', issueNumber: 18, failures: [] }),
    ).resolves.toEqual({ action: 'updated', commentId: 7 });

    expect(calls.some(([method, url]) => method === 'PATCH' && url.endsWith('/issues/comments/7'))).toBe(true);

    const createCalls = [];
    const createFetch = async (url, options = {}) => {
      createCalls.push([options.method ?? 'GET', url, options.body ? JSON.parse(options.body) : undefined]);
      return response((options.method ?? 'GET') === 'GET' ? [] : { id: 9 });
    };

    await expect(
      upsertIssueStandardsComment({
        fetchImpl: createFetch,
        repository: 'LMLiam/Casino-Warehouse',
        token: 'token',
        issueNumber: 18,
        failures: ['Add an area label.'],
      }),
    ).resolves.toEqual({ action: 'created', commentId: 9 });

    expect(createCalls.some(([method, url]) => method === 'POST' && url.endsWith('/issues/18/comments'))).toBe(true);

    await expect(
      upsertIssueStandardsComment({ fetchImpl: createFetch, repository: 'LMLiam/Casino-Warehouse', token: 'token', issueNumber: 18, failures: [] }),
    ).resolves.toEqual({ action: 'skipped' });
  });

  it('updates one canonical marker comment and deletes duplicates', async () => {
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
      calls.push([options.method ?? 'GET', url, options.body ? JSON.parse(options.body) : undefined]);
      if ((options.method ?? 'GET') === 'GET') {
        return response([
          { id: 7, body: `${issueStandardsCommentMarker}\nold guidance` },
          { id: 8, body: 'regular issue discussion' },
          { id: 9, body: `${issueStandardsCommentMarker}\nduplicate guidance` },
          { id: 10, body: `${issueStandardsCommentMarker}\nolder duplicate guidance` },
        ]);
      }
      return response((options.method ?? 'GET') === 'DELETE' ? undefined : { id: 7 });
    };

    await expect(
      upsertIssueStandardsComment({
        fetchImpl,
        repository: 'LMLiam/Casino-Warehouse',
        token: 'token',
        issueNumber: 18,
        failures: ['Add a status label.'],
      }),
    ).resolves.toEqual({ action: 'updated', commentId: 7, deletedCommentIds: [9, 10] });

    expect(calls.filter(([method]) => method === 'PATCH')).toEqual([
      [
        'PATCH',
        'https://api.github.com/repos/LMLiam/Casino-Warehouse/issues/comments/7',
        expect.objectContaining({ body: expect.stringContaining('- Add a status label.') }),
      ],
    ]);
    expect(calls.filter(([method]) => method === 'DELETE').map(([, url]) => url)).toEqual([
      'https://api.github.com/repos/LMLiam/Casino-Warehouse/issues/comments/9',
      'https://api.github.com/repos/LMLiam/Casino-Warehouse/issues/comments/10',
    ]);
  });
});

function response(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}
