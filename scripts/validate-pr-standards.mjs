#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const titleTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert', 'security', 'deps'];

const titlePattern = new RegExp(`^(${titleTypes.join('|')})\\([a-z0-9][a-z0-9-]*\\): .{5,}$`);
const conventionalTitleDescription = `"type(scope): summary" using one of: ${titleTypes.join(', ')}`;

const requiredHeadings = ['Summary', 'Type', 'Checks', 'Testing', 'Notes'];

const typeOptions = ['Bug fix', 'Feature', 'Documentation', 'Refactor', 'Test or tooling'];

const commitMessagePathArgumentIndex = 3;

const requiredChecks = [
  'I read `CONTRIBUTING.md`.',
  'I kept generated build output out of this pull request.',
  'I added or updated tests, or explained why tests are not needed.',
  'I ran the relevant local checks.',
];

const summaryMinLength = 20;

const templatePlaceholders = ['Describe the change and why it is needed.', 'Anything reviewers should know:'];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function labelNames(pullRequest) {
  return (pullRequest.labels ?? []).map((label) => String(label.name ?? '').toLowerCase());
}

function isDependabotPullRequest(pullRequest) {
  return pullRequest.user?.login === 'dependabot[bot]';
}

function extractSections(body) {
  const sections = new Map();
  const matches = [...body.matchAll(/^##\s+(.+?)\s*$/gim)];

  for (const [index, match] of matches.entries()) {
    const heading = match[1].trim();
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? body.length;
    sections.set(heading.toLowerCase(), body.slice(start, end).trim());
  }

  return sections;
}

function hasCheckedItem(section, item) {
  return new RegExp(`^- \\[[xX]\\] ${escapeRegex(item)}\\s*$`, 'm').test(section);
}

function validateBody(body) {
  const failures = [];
  const sections = extractSections(body);

  for (const heading of requiredHeadings) {
    if (!sections.has(heading.toLowerCase())) {
      failures.push(`PR body must keep the "## ${heading}" template section.`);
    }
  }

  if (failures.length > 0) {
    return failures;
  }

  for (const placeholder of templatePlaceholders) {
    if (body.includes(placeholder)) {
      failures.push(`Replace the template placeholder: "${placeholder}"`);
    }
  }

  const summary = sections.get('summary');
  if (!summary || summary.length < summaryMinLength) {
    failures.push('The Summary section must describe the change and why it is needed.');
  }

  const typeSection = sections.get('type') ?? '';
  const checkedTypes = typeOptions.filter((option) => hasCheckedItem(typeSection, option));
  if (checkedTypes.length === 0) {
    failures.push('Select at least one checkbox in the Type section.');
  }

  const checksSection = sections.get('checks') ?? '';
  for (const check of requiredChecks) {
    if (!hasCheckedItem(checksSection, check)) {
      failures.push(`Complete the required check: "${check}"`);
    }
  }

  const testingSection = sections.get('testing') ?? '';
  const commandsBlock = testingSection.match(/Commands run:\s*```(?:text)?\s*([\s\S]*?)```/i);
  if (!commandsBlock || commandsBlock[1].trim().length === 0) {
    failures.push('Testing must include a non-empty "Commands run" fenced block.');
  }

  return failures;
}

export function validatePullRequest(pullRequest) {
  const failures = [];
  const title = String(pullRequest.title ?? '').trim();
  const labels = labelNames(pullRequest);
  const body = String(pullRequest.body ?? '').trim();

  if (!labels.some((label) => label.startsWith('type:'))) {
    failures.push('Add one type label, for example "type:feature" or "type:maintenance".');
  }

  if (!labels.some((label) => label.startsWith('area:'))) {
    failures.push('Add one area label, for example "area:ui", "area:gameplay", or "area:tooling".');
  }

  if (isDependabotPullRequest(pullRequest)) {
    return failures;
  }

  if (!titlePattern.test(title)) {
    failures.push(`PR title must match ${conventionalTitleDescription}.`);
  }

  failures.push(...validateBody(body));

  return failures;
}

export function validateCommitMessage(message) {
  const title = String(message).split(/\r?\n/, 1)[0]?.trim() ?? '';
  return titlePattern.test(title) ? [] : [`Commit message must match ${conventionalTitleDescription}.`];
}

/* v8 ignore start -- CLI wiring is exercised by the pull_request workflow; unit tests cover the validator contract directly. */
function loadPullRequest(eventPath) {
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));

  if (!event.pull_request) {
    throw new Error('This validator must run from a pull request event.');
  }

  return event.pull_request;
}

function main() {
  if (process.argv[2] === '--commit-message') {
    validateCommitMessageFile(process.argv[commitMessagePathArgumentIndex]);
    return;
  }

  const eventPath = process.env.PR_STANDARDS_EVENT_PATH ?? process.env.GITHUB_EVENT_PATH;

  if (!eventPath) {
    console.error('PR_STANDARDS_EVENT_PATH or GITHUB_EVENT_PATH is required.');
    process.exit(1);
  }

  const pullRequest = loadPullRequest(eventPath);
  const failures = validatePullRequest(pullRequest);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`::error::${failure}`);
    }

    console.error(`PR standards failed with ${failures.length} issue(s).`);
    process.exit(1);
  }

  console.log('PR standards passed.');
}

function validateCommitMessageFile(messagePath) {
  if (!messagePath) {
    console.error('A commit message file path is required.');
    process.exit(1);
  }

  const failures = validateCommitMessage(readFileSync(messagePath, 'utf8'));
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    process.exit(1);
  }

  console.log('Commit message standards passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
/* v8 ignore stop */
