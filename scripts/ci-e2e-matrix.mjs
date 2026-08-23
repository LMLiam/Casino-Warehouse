#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const e2eSuiteDir = 'tests/e2e';
const defaultWorkers = 1;
const balanceSkewToleranceRatio = 0.25;
const reportBalanceFlagIndex = 2;

const visualSuites = ['casino-visual.spec.ts'];
const multiplayerSuites = ['multiplayer-flow.spec.ts', 'public-tunnel-smoke.spec.ts'];

// Single source of truth for the Project Checks e2e matrix. Adding a lane or
// changing a shard count happens here; the workflow expands whatever this
// script emits (#88).
const e2eLanes = [
  { id: 'laptop-visual', label: 'Laptop Visual', project: 'laptop', suites: visualSuites, shards: 1 },
  { id: 'tablet-visual', label: 'Tablet Visual', project: 'tablet', suites: visualSuites, shards: 1 },
  { id: 'laptop-multiplayer', label: 'Laptop Multiplayer', project: 'laptop', suites: multiplayerSuites, shards: 2 },
];

const requiredLaneFields = ['id', 'label', 'project', 'suites', 'shards'];

function validateLanes(lanes) {
  const failures = [];
  const seenIds = new Set();

  for (const lane of lanes) {
    for (const field of requiredLaneFields) {
      if (lane[field] === undefined) {
        failures.push(`Lane "${lane.id ?? '(unnamed)'}" is missing the "${field}" field.`);
      }
    }

    if (seenIds.has(lane.id)) {
      failures.push(`Lane id "${lane.id}" is duplicated.`);
    }
    seenIds.add(lane.id);

    if (!Number.isInteger(lane.shards) || lane.shards < 1) {
      failures.push(`Lane "${lane.id}" needs an integer shard count of at least 1.`);
    }

    if (!Array.isArray(lane.suites) || lane.suites.length === 0) {
      failures.push(`Lane "${lane.id}" needs at least one suite file.`);
      continue;
    }

    for (const suite of lane.suites) {
      if (!existsSync(join(repositoryRoot, e2eSuiteDir, suite))) {
        failures.push(`Lane "${lane.id}" references missing suite file ${e2eSuiteDir}/${suite}.`);
      }
    }
  }

  return failures;
}

function shardSuffix(shardIndex, shardCount) {
  return shardCount > 1 ? `-${shardIndex}` : '';
}

function labelSuffix(shardIndex, shardCount) {
  return shardCount > 1 ? ` ${shardIndex}/${shardCount}` : '';
}

function playwrightArgsFor(lane, shardIndex, shardCount) {
  const shardFlag = shardCount > 1 ? ` --shard=${shardIndex}/${shardCount}` : '';
  const suitePaths = lane.suites.map((suite) => `${e2eSuiteDir}/${suite}`).join(' ');
  return `--workers=${defaultWorkers} --project=${lane.project}${shardFlag} ${suitePaths}`;
}

export function buildE2eMatrix(lanes = e2eLanes) {
  const failures = validateLanes(lanes);
  if (failures.length > 0) {
    throw new Error(`Invalid e2e lane configuration:\n- ${failures.join('\n- ')}`);
  }

  const entries = [];
  for (const lane of lanes) {
    for (let shardIndex = 1; shardIndex <= lane.shards; shardIndex += 1) {
      entries.push({
        name: `${lane.id}${shardSuffix(shardIndex, lane.shards)}`,
        label: `${lane.label}${labelSuffix(shardIndex, lane.shards)}`,
        playwrightArgs: playwrightArgsFor(lane, shardIndex, lane.shards),
      });
    }
  }
  return entries;
}

function shardTestCounts(lane) {
  return Array.from({ length: lane.shards }, (_, index) => {
    const shardIndex = index + 1;
    const output = execFileSync(
      'npx',
      [
        'playwright',
        'test',
        `--project=${lane.project}`,
        `--shard=${shardIndex}/${lane.shards}`,
        '--list',
        ...lane.suites.map((suite) => `${e2eSuiteDir}/${suite}`),
      ],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    const match = output.match(/Total:\s+(\d+) tests?/);
    return { shardIndex, count: match ? Number(match[1]) : Number.NaN };
  });
}

function reportBalance() {
  let reportedSkew = false;
  for (const lane of e2eLanes) {
    if (lane.shards < 2) {
      continue;
    }
    const counts = shardTestCounts(lane);
    const maximum = Math.max(...counts.map((entry) => entry.count));
    const minimum = Math.min(...counts.map((entry) => entry.count));
    const skewed = minimum === 0 || maximum - minimum > maximum * balanceSkewToleranceRatio;
    console.log(`${lane.id}: ${counts.map((entry) => `shard ${entry.shardIndex}=${entry.count}`).join(', ')}${skewed ? ' (skewed beyond tolerance)' : ''}`);
    reportedSkew ||= skewed;
  }
  return reportedSkew ? 1 : 0;
}

function main() {
  if (process.argv[reportBalanceFlagIndex] === '--report-balance') {
    process.exit(reportBalance());
  }

  try {
    process.stdout.write(JSON.stringify(buildE2eMatrix()));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
