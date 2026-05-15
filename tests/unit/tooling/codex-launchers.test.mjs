import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

const issueGoal =
  '/goal Complete issue #128 in a separate worktree using $casino-issue-completion + AGENTS.md: complete correct implementation, open/update PR, evidence review, current main, green checks, readiness report.';

const triageGoal =
  '/goal Triage issue #121 using $casino-issue-triage + AGENTS.md: inspect the issue, search existing issues and pull requests for duplicates or related work, inspect repository context, update issue metadata or body only when evidence supports it, verify the updated issue, and report the before/after triage evidence.';

const issueDependenciesGoal =
  '/goal Audit Casino Warehouse issue dependencies using $casino-issue-dependency-audit + AGENTS.md: review every open issue for dependency or sequencing relationships; list open issues by milestone, label, and status; inspect issue bodies, comments, linked pull requests, reverse references, and repository guidance; distinguish hard blockers from preferred order using milestone context and evidence; update issue labels, bodies, or canonical dependency comments only when evidence supports it; avoid closing, deprioritizing, or re-scoping issues unless a maintainer explicitly asks; verify any updates; and report a maintainer-readable dependency map listing each blocker relationship in both directions plus preferred sequencing, stale relationships, unresolved clarification needs, commands used, skipped checks, and residual risk.';

const prReviewGoal =
  '/goal Review pull request #42 in full using $casino-pr-full-review, $casino-issue-completion, and AGENTS.md: use a separate worktree when local checkout is needed, inspect the full PR diff and related context, check prior comments/base freshness/CI, run relevant evidence checks, leave inline GitHub review comments for every finding or record exact comment failure, and report an evidence-backed verdict.';

const securityReviewGoal =
  '/goal Run a focused Casino Warehouse security review for pull request #123 using $casino-security-review + AGENTS.md: inspect the target and related security controls, review related tests and existing safeguards before recommending changes, cover admin token, profile token, server authority, public tunnel, WebSocket origin, persistence, dependency, workflow pinning, CodeQL, and Dependency Review risks where relevant, verify any current vulnerability, advisory, CVE, deprecation, version, or best-practice claim with current sources, avoid weakening existing controls, and report findings with locations, severity, exploit or failure mode, evidence, suggested fixes, blocking status, residual risk, commands run, sources, and unresolved assumptions.';

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

  it('prints the issue-triage goal without launching Codex', () => {
    const result = runLauncher('start-codex-triage-issue.sh', ['--dry-run', '121']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(triageGoal);
    expect(result.stderr).toBe('');
  });

  it('prints the issue-dependency-audit goal without launching Codex', () => {
    const result = runLauncher('start-codex-issue-dependencies.sh', ['--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(issueDependenciesGoal);
    expect(result.stderr).toBe('');
  });

  it('prints the security-review goal without launching Codex', () => {
    const result = runLauncher('start-codex-security-pass.sh', ['--dry-run', 'pull request #123']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(securityReviewGoal);
    expect(result.stderr).toBe('');
  });

  it('rejects non-numeric issue, triage issue, pull request, and empty security-review input', () => {
    const issueResult = runLauncher('start-codex-issue.sh', ['abc']);
    const triageResult = runLauncher('start-codex-triage-issue.sh', ['not-an-issue']);
    const prResult = runLauncher('start-codex-pr-review.sh', ['not-a-pr']);
    const securityResult = runLauncher('start-codex-security-pass.sh', [], {
      env: { CODEX_BIN: 'definitely-not-codex' },
    });

    expect(issueResult.status).toBe(2);
    expect(issueResult.stderr).toContain('error: issue number must be numeric');
    expect(triageResult.status).toBe(2);
    expect(triageResult.stderr).toContain('error: issue number must be numeric');
    expect(prResult.status).toBe(2);
    expect(prResult.stderr).toContain('error: pull request number must be numeric');
    expect(securityResult.status).toBe(2);
    expect(securityResult.stderr).toContain('error: security review target is required');
  });

  it('validates the Casino Warehouse repository root before print mode', () => {
    const outsideRepo = mkdtempSync(join(tmpdir(), 'casino-launcher-outside-'));

    try {
      for (const [script, number] of [
        ['start-codex-issue.sh', '128'],
        ['start-codex-triage-issue.sh', '121'],
        ['start-codex-issue-dependencies.sh', ''],
        ['start-codex-pr-review.sh', '42'],
        ['start-codex-security-pass.sh', 'pull request #123'],
      ]) {
        const args = number ? ['--print', number] : ['--print'];
        const result = runLauncher(script, args, { cwd: outsideRepo });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('error: run this script from the Casino Warehouse repository root.');
      }
    } finally {
      rmSync(outsideRepo, { force: true, recursive: true });
    }
  });

  it('reports a missing Codex executable before launching', () => {
    for (const [script, number] of [
      ['start-codex-issue.sh', '128'],
      ['start-codex-triage-issue.sh', '121'],
      ['start-codex-issue-dependencies.sh', ''],
      ['start-codex-pr-review.sh', '42'],
      ['start-codex-security-pass.sh', 'pull request #123'],
    ]) {
      const args = number ? [number] : [];
      const result = runLauncher(script, args, {
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
        ['start-codex-triage-issue.sh', '121'],
        ['start-codex-issue-dependencies.sh', ''],
        ['start-codex-pr-review.sh', '42'],
        ['start-codex-security-pass.sh', 'pull request #123'],
      ]) {
        const args = number ? [number] : [];
        const result = runLauncher(script, args, {
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
    const triageLauncher = readFileSync(join(repoRoot, 'start-codex-triage-issue.sh'), 'utf8');
    const issueDependenciesLauncher = readFileSync(join(repoRoot, 'start-codex-issue-dependencies.sh'), 'utf8');
    const prLauncher = readFileSync(join(repoRoot, 'start-codex-pr-review.sh'), 'utf8');
    const securityLauncher = readFileSync(join(repoRoot, 'start-codex-security-pass.sh'), 'utf8');
    const helper = readFileSync(join(repoRoot, '.agents/scripts/codex-goal-launcher.sh'), 'utf8');

    expect(issueLauncher).not.toContain('cat >"$expect_script"');
    expect(triageLauncher).not.toContain('cat >"$expect_script"');
    expect(issueDependenciesLauncher).not.toContain('cat >"$expect_script"');
    expect(prLauncher).not.toContain('cat >"$expect_script"');
    expect(securityLauncher).not.toContain('cat >"$expect_script"');
    expect(helper).toContain('-re {·[^\\r\\n]*(~|/)}');
  });

  it('keeps launcher scripts syntactically valid bash', () => {
    for (const script of [
      'start-codex-issue.sh',
      'start-codex-triage-issue.sh',
      'start-codex-issue-dependencies.sh',
      'start-codex-pr-review.sh',
      'start-codex-security-pass.sh',
      '.agents/scripts/codex-goal-launcher.sh',
    ]) {
      const result = spawnSync(process.env.BASH ?? '/bin/bash', ['-n', join(repoRoot, script)], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    }
  });
});
