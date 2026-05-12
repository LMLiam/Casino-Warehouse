#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowDir = '.github/workflows';
const dependabotPath = '.github/dependabot.yml';
const dependencyReviewPath = '.github/workflows/dependency-review.yml';
const fullShaPattern = /^[a-f0-9]{40}$/i;
const failures = [];

checkWorkflowActionPins();
checkDependabotActionsUpdates();
checkDependencyReviewPolicy();

if (failures.length > 0) {
  console.error(['Supply-chain check failed:', ...failures.map((failure) => `- ${failure}`)].join('\n'));
  process.exit(1);
}

console.log('Supply-chain check passed.');

function checkWorkflowActionPins() {
  for (const file of workflowFiles()) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/^\s*uses:\s*([^#\s]+)(?:\s+#\s*(\S.*))?$/);
      if (!match) {
        return;
      }

      const target = stripQuotes(match[1]);
      if (target.startsWith('./')) {
        return;
      }

      const [, ref] = target.split('@');
      if (!ref) {
        failures.push(`${file}:${index + 1} uses ${target} without an explicit ref.`);
        return;
      }

      if (!fullShaPattern.test(ref)) {
        failures.push(`${file}:${index + 1} uses ${target}. Pin external actions to a full 40-character commit SHA.`);
      }

      if (!match[2]) {
        failures.push(`${file}:${index + 1} must keep a same-line version comment for Dependabot, for example "# v1.2.3".`);
      }
    });
  }
}

function checkDependabotActionsUpdates() {
  const source = readFileSync(dependabotPath, 'utf8');
  const requiredFragments = [
    'package-ecosystem: github-actions',
    'directory: /',
    'interval: weekly',
    'open-pull-requests-limit: 2',
    'groups:',
    'github-actions:',
  ];

  for (const fragment of requiredFragments) {
    if (!source.includes(fragment)) {
      failures.push(`${dependabotPath} must include "${fragment}" for bounded GitHub Actions updates.`);
    }
  }
}

function checkDependencyReviewPolicy() {
  const source = readFileSync(dependencyReviewPath, 'utf8');
  const requiredFragments = ['fail-on-severity: moderate', 'fail-on-scopes: runtime,development,unknown'];

  for (const fragment of requiredFragments) {
    if (!source.includes(fragment)) {
      failures.push(`${dependencyReviewPath} must include "${fragment}".`);
    }
  }
}

function workflowFiles() {
  return readdirSync(workflowDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => join(workflowDir, name));
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '');
}
