import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

const issueGoal =
  '/goal Complete issue #128 in a separate worktree using $casino-issue-completion + AGENTS.md: complete correct implementation, open/update PR, evidence review, current main, green checks, readiness report.';

const prReviewGoal =
  '/goal Review pull request #42 in full using $casino-pr-full-review, $casino-issue-completion, and AGENTS.md: use a separate worktree when local checkout is needed, inspect the full PR diff and related context, check prior comments/base freshness/CI, run relevant evidence checks, leave inline GitHub review comments for every finding or record exact comment failure, and report an evidence-backed verdict.';

const runLauncher = (script, args, options = {}) =>
  spawnSync(process.env.BASH ?? '/bin/bash', [join(repoRoot, script), ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
  });

describe('Codex launcher scripts', () => {
  it('prints the issue-completion goal without launching Codex', () => {
    const result = runLauncher('start-codex-issue.sh', ['--print', '128']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(issueGoal);
    expect(result.stderr).toBe('');
  });

  it('prints the PR-review goal without launching Codex', () => {
    const result = runLauncher('start-codex-pr-review.sh', ['--dry-run', '42']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(prReviewGoal);
    expect(result.stderr).toBe('');
  });

  it('rejects non-numeric issue and pull request input', () => {
    const issueResult = runLauncher('start-codex-issue.sh', ['abc']);
    const prResult = runLauncher('start-codex-pr-review.sh', ['not-a-pr']);

    expect(issueResult.status).toBe(2);
    expect(issueResult.stderr).toContain('error: issue number must be numeric');
    expect(prResult.status).toBe(2);
    expect(prResult.stderr).toContain('error: pull request number must be numeric');
  });

  it('validates the Casino Warehouse repository root before print mode', () => {
    const outsideRepo = mkdtempSync(join(tmpdir(), 'casino-launcher-outside-'));

    try {
      const result = runLauncher('start-codex-issue.sh', ['--print', '128'], { cwd: outsideRepo });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('error: run this script from the Casino Warehouse repository root.');
    } finally {
      rmSync(outsideRepo, { force: true, recursive: true });
    }
  });

  it('reports a missing Codex executable before launching', () => {
    for (const [script, number] of [
      ['start-codex-issue.sh', '128'],
      ['start-codex-pr-review.sh', '42'],
    ]) {
      const result = runLauncher(script, [number], {
        env: { CODEX_BIN: 'definitely-not-codex' },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('error: Codex executable not found: definitely-not-codex');
    }
  });

  it('reports missing expect from the shared launcher helper', () => {
    const binDir = mkdtempSync(join(tmpdir(), 'casino-launcher-bin-'));

    try {
      const codexShim = join(binDir, 'codex');
      writeFileSync(codexShim, '#!/bin/sh\nexit 0\n');
      chmodSync(codexShim, 0o755);

      for (const [script, number] of [
        ['start-codex-issue.sh', '128'],
        ['start-codex-pr-review.sh', '42'],
      ]) {
        const result = runLauncher(script, [number], {
          env: { CODEX_BIN: 'codex', PATH: binDir },
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('error: expect is required to drive the interactive Codex /goal command.');
      }
    } finally {
      rmSync(binDir, { force: true, recursive: true });
    }
  });

  it('keeps the expect flow and readiness pattern in the shared helper', () => {
    const issueLauncher = readFileSync(join(repoRoot, 'start-codex-issue.sh'), 'utf8');
    const prLauncher = readFileSync(join(repoRoot, 'start-codex-pr-review.sh'), 'utf8');
    const helper = readFileSync(join(repoRoot, '.agents/scripts/codex-goal-launcher.sh'), 'utf8');

    expect(issueLauncher).not.toContain('cat >"$expect_script"');
    expect(prLauncher).not.toContain('cat >"$expect_script"');
    expect(helper).toContain('-re {·[^\\r\\n]*(~|/)}');
  });
});
