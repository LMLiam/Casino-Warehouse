#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const issueStandardsCommentMarker = '<!-- casino-warehouse:issue-standards -->';

const titleTypes = ['bug', 'feature', 'maintenance', 'docs', 'test', 'ci', 'security', 'deps', 'question'];
const titlePattern = new RegExp(`^(${titleTypes.join('|')})\\([a-z0-9][a-z0-9-]*\\): .{5,}$`);
const planningTypes = ['feature', 'maintenance', 'docs', 'test', 'ci', 'security', 'deps'];
const placeholderPatterns = [
  /^\s*(?:n\/a|none|no response|todo|tbd|placeholder)\s*$/i,
  /\[Feature\]:|\[Bug\]:/i,
  /1\.\s*Open \.\.\./i,
  /2\.\s*Click \.\.\./i,
  /3\.\s*See \.\.\./i,
];

function issueLabels(issue) {
  return (issue.labels ?? []).map((label) => String(label.name ?? label ?? '').toLowerCase());
}

function titleType(title) {
  return title.match(/^([a-z]+)\(/)?.[1];
}

function extractSections(body) {
  const sections = new Map();
  const matches = [...body.matchAll(/^#{2,3}\s+(.+?)\s*$/gim)];

  for (const [index, match] of matches.entries()) {
    const heading = match[1].trim();
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? body.length;
    sections.set(heading.toLowerCase(), body.slice(start, end).trim());
  }

  return sections;
}

function meaningful(value, minLength = 12) {
  const text = String(value ?? '').trim();
  return text.length >= minLength && !placeholderPatterns.some((pattern) => pattern.test(text));
}

function hasAcceptanceCriteria(body) {
  const sections = extractSections(body);
  const acceptance = sections.get('acceptance criteria');
  return meaningful(acceptance, 20) || /\bacceptance criteria\b/i.test(body);
}

function validateRequiredSections(sections, requiredSections, issueKind) {
  const failures = [];
  for (const section of requiredSections) {
    const content = sections.get(section.toLowerCase());
    if (!content) {
      failures.push(`${issueKind} issues must include a "## ${section}" section.`);
      continue;
    }
    if (!meaningful(content)) {
      failures.push(`Fill in the "## ${section}" section with concrete, non-placeholder detail.`);
    }
  }
  return failures;
}

export function validateIssue(issue) {
  const failures = [];
  const title = String(issue.title ?? '').trim();
  const body = String(issue.body ?? '').trim();
  const labels = issueLabels(issue);
  const issueTitleType = titleType(title);
  const sections = extractSections(body);

  if (!titlePattern.test(title)) {
    failures.push(`Issue title must match "type(scope): summary" using one of: ${titleTypes.join(', ')}.`);
  }

  if (!labels.some((label) => label.startsWith('type:'))) {
    failures.push('Add one type label, for example "type:bug", "type:feature", or "type:maintenance".');
  }

  if (!labels.some((label) => label.startsWith('area:'))) {
    failures.push('Add one area label, for example "area:ui", "area:gameplay", or "area:tooling".');
  }

  if (!labels.some((label) => label.startsWith('status:'))) {
    failures.push('Add one status label, for example "status:needs-triage" or "status:ready".');
  }

  if (!body || !meaningful(body, 30)) {
    failures.push('Fill in the issue body with concrete, non-placeholder detail.');
  }

  if (issueTitleType === 'bug' || labels.includes('type:bug')) {
    failures.push(...validateRequiredSections(sections, ['Summary', 'Steps to reproduce', 'Expected behaviour', 'Actual behaviour'], 'Bug'));
  } else if (planningTypes.includes(issueTitleType ?? '') || labels.includes('type:feature') || labels.includes('type:maintenance')) {
    failures.push(...validateRequiredSections(sections, ['Problem or opportunity', 'Proposed solution'], 'Planning'));
  } else if (issueTitleType === 'question' && !meaningful(sections.get('summary') ?? sections.get('problem or opportunity') ?? body, 20)) {
    failures.push('Question issues must include a meaningful "## Summary" or "## Problem or opportunity" section.');
  }

  if (labels.includes('status:ready')) {
    if (!issue.milestone) {
      failures.push('Issues marked "status:ready" must be assigned to a milestone.');
    }
    if (!hasAcceptanceCriteria(body) && !meaningful(sections.get('proposed solution'), 40)) {
      failures.push('Issues marked "status:ready" must include a clear next action or acceptance criteria.');
    }
  }

  return [...new Set(failures)];
}

export function buildIssueStandardsComment(failures) {
  if (failures.length === 0) {
    return `${issueStandardsCommentMarker}
## Issue metadata passes

This issue now meets the repository issue standards. Thanks for tightening it up.`;
  }

  return `${issueStandardsCommentMarker}
## Issue metadata needs attention

This issue does not currently meet the repository issue standards. Please update the issue using the checklist below, then the workflow will re-check it automatically.

${failures.map((failure) => `- ${failure}`).join('\n')}

Common fixes include renaming the title to \`type(scope): summary\`, adding the missing \`type:*\`, \`area:*\`, or \`status:*\` label, assigning a milestone when \`status:ready\` is used, and filling in the required template sections with concrete detail.`;
}

async function githubRequest({ fetchImpl, method = 'GET', repository, token, path, body }) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${method} ${path} failed with ${response.status}: ${text}`);
  }

  return response.status === 204 ? undefined : response.json();
}

export async function upsertIssueStandardsComment({ fetchImpl = fetch, repository, token, issueNumber, failures }) {
  if (!repository || !token || !issueNumber) {
    throw new Error('repository, token, and issueNumber are required to update issue standards comments.');
  }

  const comments = await githubRequest({ fetchImpl, repository, token, path: `/issues/${issueNumber}/comments?per_page=100` });
  const existingComments = comments.filter((comment) => String(comment.body ?? '').includes(issueStandardsCommentMarker));
  const [existing, ...duplicates] = existingComments;
  const body = buildIssueStandardsComment(failures);

  if (existing) {
    await githubRequest({ fetchImpl, method: 'PATCH', repository, token, path: `/issues/comments/${existing.id}`, body: { body } });

    for (const duplicate of duplicates) {
      await githubRequest({ fetchImpl, method: 'DELETE', repository, token, path: `/issues/comments/${duplicate.id}` });
    }

    return duplicates.length > 0
      ? { action: 'updated', commentId: existing.id, deletedCommentIds: duplicates.map((duplicate) => duplicate.id) }
      : { action: 'updated', commentId: existing.id };
  }

  if (failures.length === 0) {
    return { action: 'skipped' };
  }

  const created = await githubRequest({ fetchImpl, method: 'POST', repository, token, path: `/issues/${issueNumber}/comments`, body: { body } });
  return { action: 'created', commentId: created.id };
}

function loadIssue(eventPath) {
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));

  if (!event.issue) {
    throw new Error('This validator must run from an issues event.');
  }

  return event.issue;
}

async function main() {
  const eventPath = process.env.ISSUE_STANDARDS_EVENT_PATH ?? process.env.GITHUB_EVENT_PATH;

  if (!eventPath) {
    console.error('ISSUE_STANDARDS_EVENT_PATH or GITHUB_EVENT_PATH is required.');
    process.exit(1);
  }

  const issue = loadIssue(eventPath);
  const failures = validateIssue(issue);

  try {
    if (process.env.ISSUE_STANDARDS_SKIP_COMMENT !== 'true') {
      await upsertIssueStandardsComment({
        repository: process.env.GITHUB_REPOSITORY,
        token: process.env.GITHUB_TOKEN,
        issueNumber: issue.number,
        failures,
      });
    }
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : 'Unable to update issue standards comment.'}`);
    process.exit(1);
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`::error::${failure}`);
    }

    console.error(`Issue standards failed with ${failures.length} issue(s).`);
    process.exit(1);
  }

  console.log('Issue standards passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
