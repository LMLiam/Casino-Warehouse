#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workflowDir = '.github/workflows';
const dependabotPath = '.github/dependabot.yml';
const dependencyReviewPath = '.github/workflows/dependency-review.yml';
const fullShaPattern = /^[a-f0-9]{40}$/i;
/* v8 ignore start -- CLI filesystem wiring is exercised by npm run supply-chain:check; unit tests cover pure policy helpers. */
function main() {
  const failures = [];

  checkWorkflowActionPins(failures);
  checkDependabotActionsUpdates(failures);
  checkDependencyReviewPolicy(failures);

  if (failures.length > 0) {
    console.error(['Supply-chain check failed:', ...failures.map((failure) => `- ${failure}`)].join('\n'));
    process.exit(1);
  }

  console.log('Supply-chain check passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

function checkWorkflowActionPins(failures) {
  const workflows = workflowFiles().map((file) => ({
    path: file,
    source: readFileSync(file, 'utf8'),
  }));
  failures.push(...workflowActionPinFailures(workflows));
}
/* v8 ignore stop */

export function workflowActionPinFailures(workflows) {
  const failures = [];

  for (const workflow of workflows) {
    const lines = workflow.source.split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/^\s*(?:-\s*)?uses:\s*([^#\s]+)(?:\s+#\s*(\S.*))?$/);
      if (!match) {
        return;
      }

      const target = stripQuotes(match[1]);
      if (target.startsWith('./')) {
        return;
      }

      const [, ref] = target.split('@');
      if (!ref) {
        failures.push(`${workflow.path}:${index + 1} uses ${target} without an explicit ref.`);
        return;
      }

      if (!fullShaPattern.test(ref)) {
        failures.push(`${workflow.path}:${index + 1} uses ${target}. Pin external actions to a full 40-character commit SHA.`);
      }

      if (!match[2]) {
        failures.push(`${workflow.path}:${index + 1} must keep a same-line version comment for Dependabot, for example "# v1.2.3".`);
      }
    });
  }

  return failures;
}

/* v8 ignore start -- CLI filesystem wiring is exercised by npm run supply-chain:check; unit tests cover pure policy helpers. */
function checkDependabotActionsUpdates(failures) {
  const source = readFileSync(dependabotPath, 'utf8');
  failures.push(...dependabotActionsUpdateFailures(source, dependabotPath));
}
/* v8 ignore stop */

export function dependabotActionsUpdateFailures(source, path = dependabotPath) {
  const githubActionsBlock = dependabotUpdateBlocks(source).find((block) => dependabotBlockValue(block, 'package-ecosystem') === 'github-actions');

  if (!githubActionsBlock) {
    return [`${path} must include a github-actions update block for bounded GitHub Actions updates.`];
  }

  const requiredSettings = [
    ['directory', '/'],
    ['interval', 'weekly'],
    ['open-pull-requests-limit', '2'],
  ];
  const failures = [];

  for (const [key, value] of requiredSettings) {
    if (dependabotBlockValue(githubActionsBlock, key) !== value) {
      failures.push(`${path} github-actions update block must include "${key}: ${value}" for bounded GitHub Actions updates.`);
    }
  }

  if (!/^\s+groups:\s*(?:#.*)?$/m.test(githubActionsBlock)) {
    failures.push(`${path} github-actions update block must include "groups:" for bounded GitHub Actions updates.`);
  }

  if (!/^\s+github-actions:\s*(?:#.*)?$/m.test(githubActionsBlock)) {
    failures.push(`${path} github-actions update block must include a "github-actions:" group for bounded GitHub Actions updates.`);
  }

  return failures;
}

/* v8 ignore start -- CLI filesystem wiring is exercised by npm run supply-chain:check; unit tests cover pure policy helpers. */
function checkDependencyReviewPolicy(failures) {
  const source = readFileSync(dependencyReviewPath, 'utf8');
  failures.push(...dependencyReviewPolicyFailures(source, dependencyReviewPath));
}
/* v8 ignore stop */

export function dependencyReviewPolicyFailures(source, path = dependencyReviewPath) {
  const requiredFragments = ['fail-on-severity: moderate', 'fail-on-scopes: runtime,development,unknown'];
  const failures = [];

  for (const fragment of requiredFragments) {
    if (!source.includes(fragment)) {
      failures.push(`${path} must include "${fragment}".`);
    }
  }

  return failures;
}

/* v8 ignore start -- CLI filesystem wiring is exercised by npm run supply-chain:check; unit tests cover pure policy helpers. */
function workflowFiles() {
  return readdirSync(workflowDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => join(workflowDir, name));
}
/* v8 ignore stop */

function dependabotUpdateBlocks(source) {
  const blocks = [];
  let currentBlock = null;
  let inUpdates = false;

  for (const line of source.split('\n')) {
    if (/^updates:\s*(?:#.*)?$/.test(line)) {
      inUpdates = true;
      continue;
    }

    if (!inUpdates) {
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }

    if (/^ {2}-\s+/.test(line)) {
      if (currentBlock) {
        blocks.push(currentBlock.join('\n'));
      }
      currentBlock = [line];
      continue;
    }

    currentBlock?.push(line);
  }

  if (currentBlock) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks;
}

function dependabotBlockValue(block, key) {
  const keyPattern = escapeRegex(key);
  const match = block.match(new RegExp(`^\\s*(?:-\\s*)?${keyPattern}:\\s*([^#\\n]+?)\\s*(?:#.*)?$`, 'm'));
  return match ? stripQuotes(match[1].trim()) : null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '');
}
