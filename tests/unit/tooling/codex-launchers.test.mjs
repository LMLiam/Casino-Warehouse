import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const launcherScript = (script) => join('.agents', 'launchers', script);

const issueGoal =
  '/goal Complete issue #128 in a separate worktree using $casino-issue-completion + AGENTS.md: complete correct implementation, open/update PR, evidence review, current main, green checks, readiness report.';

const createIssueGoal =
  '/goal Create a researched GitHub issue for Casino Warehouse using $casino-issue-creation + AGENTS.md: add a launcher menu. Inspect relevant repository context, search existing issues and pull requests for duplicates, choose compliant title/labels/status/milestone, create the issue through GitHub, verify the created issue, and report the evidence summary.';

const triageGoal =
  '/goal Triage issue #121 using $casino-issue-triage + AGENTS.md: inspect the issue, search existing issues and pull requests for duplicates or related work, inspect repository context, update issue metadata or body only when evidence supports it, verify the updated issue, and report the before/after triage evidence.';

const ciFailureGoal =
  '/goal Inspect failing Casino Warehouse checks for pull request #123 using $casino-ci-failure-review + AGENTS.md: fetch current PR metadata, head SHA, base branch, required check status, workflow runs, failing jobs, and relevant logs; distinguish required checks from informational or external checks; map visual/e2e failures to local reproduction commands; classify failures, avoid speculative fixes, ask before making fixes unless this active goal explicitly asks to fix CI, and report the evidence-backed diagnosis, proposed fix path, commands or logs used, and residual risk.';

const docsAuditGoal =
  '/goal Audit Casino Warehouse documentation drift using $casino-docs-audit + AGENTS.md: focus on launcher docs; compare documented claims against source-of-truth files, commands, GitHub metadata, and wiki evidence; record files inspected, wiki pages inspected or skipped, commands/API calls used, drift findings with evidence and severity, skipped checks, and whether each finding is docs-only or needs implementation work.';

const issueDependenciesGoal =
  '/goal Audit Casino Warehouse issue dependencies using $casino-issue-dependency-audit + AGENTS.md: review every open issue for dependency or sequencing relationships; list open issues by milestone, label, and status; inspect issue bodies, comments, linked pull requests, reverse references, and repository guidance; distinguish hard blockers from preferred order using milestone context and evidence; update issue labels, bodies, or canonical dependency comments only when evidence supports it; avoid closing, deprioritizing, or re-scoping issues unless a maintainer explicitly asks; verify any updates; and report a maintainer-readable dependency map listing each blocker relationship in both directions plus preferred sequencing, stale relationships, unresolved clarification needs, commands used, skipped checks, and residual risk.';

const prReviewGoal =
  '/goal Review pull request #42 in full using $casino-pr-full-review, $casino-issue-completion, and AGENTS.md: use a separate worktree when local checkout is needed, inspect the full PR diff and related context, check prior comments/base freshness/CI, run relevant evidence checks, leave inline GitHub review comments for every finding or record exact comment failure, use the issue-completion evidence and status rules for any readiness claim, and report an evidence-backed verdict.';

const securityReviewGoal =
  '/goal Run a focused Casino Warehouse security review for pull request #123 using $casino-security-review + AGENTS.md: inspect the target and related security controls, review related tests and existing safeguards before recommending changes, cover admin token, profile token, server authority, public tunnel, WebSocket origin, persistence, dependency, workflow pinning, CodeQL, and Dependency Review risks where relevant, verify any current vulnerability, advisory, CVE, deprecation, version, or best-practice claim with current sources, avoid weakening existing controls, and report findings with locations, severity, exploit or failure mode, evidence, suggested fixes, blocking status, residual risk, commands run, sources, and unresolved assumptions.';

const multiplayerReviewGoal =
  '/goal Run a Casino Warehouse multiplayer regression review for pull request #123 using $casino-multiplayer-regression + AGENTS.md: inspect changed files and related protocol schemas, server authority, client realtime URL behavior, public tunnel scripts, persistence boundaries, and relevant tests; cover room lifecycle, host/join flows, seat claims, spectators, reconnect/reload behavior, heartbeat handling, WebSocket origin checks, public invite URLs, profile ownership, admin permissions, room snapshots, settlements, and persistence reconciliation; map changed surfaces to targeted unit, state, and Playwright checks including multiplayer flow and public tunnel smoke when relevant; require deterministic fixtures for game/state assertions, avoid UI recomputation of payouts or settlement logic, record when live public tunnel smoke cannot be run with the exact command and environment needed, and report target, changed files or subsystem reviewed, commands run, multiplayer risks checked, findings with location/severity/failure mode/evidence/suggested fix/blocking status, residual risk, and unresolved assumptions.';

const architectureCleanupGoal =
  '/goal Plan and execute Casino Warehouse architecture cleanup for src/multiplayer/roomAuthority.ts using $casino-architecture-splitter + AGENTS.md: read docs/code-quality.md, the target files, imports, dependents, related tests, and architecture-check rules; produce a small staged split plan before editing when the change is large or complex; preserve behavior, domain ownership, one-top-level-element file shape, direct imports, no vague utility files, no barrels, and game/multiplayer/state authority boundaries; check circular dependency risk and run architecture checks before and after source import changes; run tests appropriate to the changed surface and report files inspected, commands run, behavior-change status, residual risk, and follow-up work.';

const runLauncher = (script, args, options = {}) =>
  spawnSync(process.env.BASH ?? '/bin/bash', [join(repoRoot, script), ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: { ...process.env, CASINO_CODEX_GOAL_STATE_VERIFY: '0', ...options.env },
    input: options.input,
  });

describe('Codex launcher scripts', () => {
  it('prints the issue-completion goal without launching Codex', () => {
    const result = runLauncher(launcherScript('start-codex-issue.sh'), ['--print', '128']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(issueGoal);
    expect(result.stderr).toBe('');
  });

  it('prints the PR-review goal without launching Codex', () => {
    const result = runLauncher(launcherScript('start-codex-pr-review.sh'), ['--dry-run', '42']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(prReviewGoal);
    expect(result.stderr).toBe('');
  });

  it('prints goals for every routine through the central launcher', () => {
    for (const [args, expectedGoal] of [
      [['--print', 'issue', '128'], issueGoal],
      [['--print', 'pr-review', '42'], prReviewGoal],
      [['--print', 'create-issue', 'add', 'a', 'launcher', 'menu'], createIssueGoal],
      [['--print', 'triage-issue', '121'], triageGoal],
      [['--print', 'ci-failure', '123'], ciFailureGoal],
      [['--print', 'docs-audit', 'launcher', 'docs'], docsAuditGoal],
      [['--print', 'issue-dependencies'], issueDependenciesGoal],
      [['--print', 'security-pass', 'pull request #123'], securityReviewGoal],
      [['--print', 'multiplayer-check', 'pull request #123'], multiplayerReviewGoal],
      [['--print', 'architecture-split', 'src/multiplayer/roomAuthority.ts'], architectureCleanupGoal],
    ]) {
      const result = runLauncher('start-codex.sh', args);

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(expectedGoal);
      expect(result.stderr).toBe('');
    }
  });

  it('shows an interactive menu and prompts only for the selected routine input', () => {
    const result = runLauncher('start-codex.sh', ['--print'], {
      input: '3\nadd a launcher menu\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(createIssueGoal);
    expect(result.stderr).toContain('Casino Warehouse Codex');
    expect(result.stderr).toContain('Issue completion');
    expect(result.stderr).toContain('Pull request review');
    expect(result.stderr).toContain('Issue creation');
    expect(result.stderr).toContain('Issue topic:');
  });

  it('can force colored menu output for terminal-style launches', () => {
    const result = runLauncher('start-codex.sh', ['--color=always', '--print'], {
      input: '3\nadd a launcher menu\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(createIssueGoal);
    expect(result.stderr).toContain('\u001B[1;36mCasino Warehouse Codex\u001B[0m');
    expect(result.stderr).toContain('\u001B[1;32m03\u001B[0m');
    expect(result.stderr).toContain('\u001B[1;35mIssue creation\u001B[0m');
  });

  it('lists every routine in help output', () => {
    const result = runLauncher('start-codex.sh', ['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--color MODE');
    expect(result.stdout).toContain('CASINO_CODEX_COLOR');
    for (const routine of [
      'issue',
      'pr-review',
      'create-issue',
      'triage-issue',
      'ci-failure',
      'docs-audit',
      'issue-dependencies',
      'security-pass',
      'multiplayer-check',
      'architecture-split',
    ]) {
      expect(result.stdout).toContain(routine);
    }
  });

  it('prints the issue-triage goal without launching Codex', () => {
    const result = runLauncher(launcherScript('start-codex-triage-issue.sh'), ['--dry-run', '121']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(triageGoal);
    expect(result.stderr).toBe('');
  });

  it('prints the issue-dependency-audit goal without launching Codex', () => {
    const result = runLauncher(launcherScript('start-codex-issue-dependencies.sh'), ['--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(issueDependenciesGoal);
    expect(result.stderr).toBe('');
  });

  it('prints the security-review goal without launching Codex', () => {
    const result = runLauncher(launcherScript('start-codex-security-pass.sh'), ['--dry-run', 'pull request #123']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(securityReviewGoal);
    expect(result.stderr).toBe('');
  });

  it('keeps compatibility wrappers for the remaining routines', () => {
    for (const [script, args, expectedGoal] of [
      [launcherScript('start-codex-create-issue.sh'), ['--print', 'add', 'a', 'launcher', 'menu'], createIssueGoal],
      [launcherScript('start-codex-ci-failure.sh'), ['--print', '123'], ciFailureGoal],
      [launcherScript('start-codex-docs-audit.sh'), ['--print', 'launcher', 'docs'], docsAuditGoal],
      [launcherScript('start-codex-multiplayer-check.sh'), ['--print', 'pull request #123'], multiplayerReviewGoal],
      [launcherScript('start-codex-architecture-split.sh'), ['--print', 'src/multiplayer/roomAuthority.ts'], architectureCleanupGoal],
    ]) {
      const result = runLauncher(script, args);

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(expectedGoal);
      expect(result.stderr).toBe('');
    }
  });

  it('rejects non-numeric issue, triage issue, pull request, and empty security-review input', () => {
    const issueResult = runLauncher(launcherScript('start-codex-issue.sh'), ['abc']);
    const triageResult = runLauncher(launcherScript('start-codex-triage-issue.sh'), ['not-an-issue']);
    const prResult = runLauncher(launcherScript('start-codex-pr-review.sh'), ['not-a-pr']);
    const centralPrResult = runLauncher('start-codex.sh', ['--print', 'ci-failure', 'not-a-pr']);
    const securityResult = runLauncher(launcherScript('start-codex-security-pass.sh'), [], {
      env: { CODEX_BIN: 'definitely-not-codex' },
    });

    expect(issueResult.status).toBe(2);
    expect(issueResult.stderr).toContain('error: issue number must be numeric');
    expect(triageResult.status).toBe(2);
    expect(triageResult.stderr).toContain('error: issue number must be numeric');
    expect(prResult.status).toBe(2);
    expect(prResult.stderr).toContain('error: pull request number must be numeric');
    expect(centralPrResult.status).toBe(2);
    expect(centralPrResult.stderr).toContain('error: pull request number must be numeric');
    expect(securityResult.status).toBe(2);
    expect(securityResult.stderr).toContain('error: security review target is required');
  });

  it('validates the Casino Warehouse repository root before print mode', () => {
    const outsideRepo = mkdtempSync(join(tmpdir(), 'casino-launcher-outside-'));

    try {
      for (const [script, number] of [
        ['start-codex.sh', 'issue 128'],
        [launcherScript('start-codex-issue.sh'), '128'],
        [launcherScript('start-codex-triage-issue.sh'), '121'],
        [launcherScript('start-codex-issue-dependencies.sh'), ''],
        [launcherScript('start-codex-pr-review.sh'), '42'],
        [launcherScript('start-codex-security-pass.sh'), 'pull request #123'],
      ]) {
        const args = number ? ['--print', ...number.split(' ')] : ['--print'];
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
      ['start-codex.sh', 'issue 128'],
      [launcherScript('start-codex-issue.sh'), '128'],
      [launcherScript('start-codex-triage-issue.sh'), '121'],
      [launcherScript('start-codex-issue-dependencies.sh'), ''],
      [launcherScript('start-codex-pr-review.sh'), '42'],
      [launcherScript('start-codex-security-pass.sh'), 'pull request #123'],
    ]) {
      const args = number ? number.split(' ') : [];
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
        ['start-codex.sh', 'issue 128'],
        [launcherScript('start-codex-issue.sh'), '128'],
        [launcherScript('start-codex-triage-issue.sh'), '121'],
        [launcherScript('start-codex-issue-dependencies.sh'), ''],
        [launcherScript('start-codex-pr-review.sh'), '42'],
        [launcherScript('start-codex-security-pass.sh'), 'pull request #123'],
      ]) {
        const args = number ? number.split(' ') : [];
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

  it('activates a long generated goal through the shared helper', () => {
    const binDir = mkdtempSync(join(tmpdir(), 'casino-launcher-codex-'));

    try {
      const codexShim = join(binDir, 'codex');
      writeFileSync(
        codexShim,
        `#!/usr/bin/env node
process.stdout.write('OpenAI Codex\\n');
process.stdout.write('gpt-5.5 xhigh fast · /tmp/casino\\n');

let buffer = '';
const timeout = setTimeout(() => {
  process.stderr.write('fake codex timed out waiting for the generated goal\\n');
  process.exit(5);
}, 30_000);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  if (!buffer.includes('\\r') && !buffer.includes('\\n')) {
    return;
  }

  clearTimeout(timeout);
  const line = buffer
    .replace(/[\\r\\n][\\s\\S]*$/, '')
    .replace(/^\\u001B\\[200~/, '')
    .replace(/\\u001B\\[201~$/, '');
  if (!line.startsWith('/goal ')) {
    process.stderr.write('fake codex received ordinary chat instead of a /goal command\\n');
    process.exit(6);
  }

  if (!line.includes('Run a Casino Warehouse multiplayer regression review for pull request #123')) {
    process.stderr.write('fake codex received the wrong generated goal\\n');
    process.exit(7);
  }

  if (!line.includes('using the casino-multiplayer-regression skill + AGENTS.md')) {
    process.stderr.write('fake codex received an unsafe skill-reference form\\n');
    process.exit(8);
  }

  if (line.includes('$casino-multiplayer-regression')) {
    process.stderr.write('fake codex received a raw TUI skill-reference token\\n');
    process.exit(9);
  }

  const activeObjective = line.replace(/^\\/goal /, '');
  process.stdout.write('Goal active Objective: ' + activeObjective + '\\n');
  setTimeout(() => process.exit(0), 25);
});
process.stdin.resume();
`,
      );
      chmodSync(codexShim, 0o755);

      const result = runLauncher('start-codex.sh', ['multiplayer-check', 'pull request #123'], {
        env: { CODEX_BIN: 'codex', CODEX_GOAL_KEY_DELAY_MS: '0', PATH: `${binDir}:${process.env.PATH}` },
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toBe('');
    } finally {
      rmSync(binDir, { force: true, recursive: true });
    }
  }, 45_000);

  it('preserves non-skill dollar text while making generated skill references TUI-safe', () => {
    const binDir = mkdtempSync(join(tmpdir(), 'casino-launcher-dollar-'));

    try {
      const codexShim = join(binDir, 'codex');
      writeFileSync(
        codexShim,
        `#!/usr/bin/env node
process.stdout.write('OpenAI Codex\\n');
process.stdout.write('gpt-5.5 xhigh fast · /tmp/casino\\n');

let buffer = '';
const timeout = setTimeout(() => {
  process.stderr.write('fake codex timed out waiting for the generated goal\\n');
  process.exit(5);
}, 30_000);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  if (!buffer.includes('\\r') && !buffer.includes('\\n')) {
    return;
  }

  clearTimeout(timeout);
  const line = buffer
    .replace(/[\\r\\n][\\s\\S]*$/, '')
    .replace(/^\\u001B\\[200~/, '')
    .replace(/\\u001B\\[201~$/, '');
  if (!line.startsWith('/goal ')) {
    process.stderr.write('fake codex received ordinary chat instead of a /goal command\\n');
    process.exit(6);
  }

  if (!line.includes('src/$PATH.ts')) {
    process.stderr.write('fake codex rewrote non-skill dollar text\\n');
    process.exit(7);
  }

  if (!line.includes('using the casino-architecture-splitter skill + AGENTS.md')) {
    process.stderr.write('fake codex received an unsafe architecture skill-reference form\\n');
    process.exit(8);
  }

  if (line.includes('$casino-architecture-splitter')) {
    process.stderr.write('fake codex received a raw TUI skill-reference token\\n');
    process.exit(9);
  }

  const activeObjective = line.replace(/^\\/goal /, '');
  process.stdout.write('Goal active Objective: ' + activeObjective + '\\n');
  setTimeout(() => process.exit(0), 25);
});
process.stdin.resume();
`,
      );
      chmodSync(codexShim, 0o755);

      const result = runLauncher('start-codex.sh', ['architecture-split', 'src/$PATH.ts'], {
        env: { CODEX_BIN: 'codex', CODEX_GOAL_KEY_DELAY_MS: '0', PATH: `${binDir}:${process.env.PATH}` },
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toBe('');
    } finally {
      rmSync(binDir, { force: true, recursive: true });
    }
  }, 45_000);

  it('rejects a Goal active confirmation when the visible objective is truncated', () => {
    const binDir = mkdtempSync(join(tmpdir(), 'casino-launcher-truncated-'));

    try {
      const codexShim = join(binDir, 'codex');
      writeFileSync(
        codexShim,
        `#!/usr/bin/env node
process.stdout.write('OpenAI Codex\\n');
process.stdout.write('gpt-5.5 xhigh fast · /tmp/casino\\n');

let buffer = '';
const timeout = setTimeout(() => {
  process.stderr.write('fake codex timed out waiting for the generated goal\\n');
  process.exit(5);
}, 30_000);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  if (!buffer.includes('\\r') && !buffer.includes('\\n')) {
    return;
  }

  clearTimeout(timeout);
  const line = buffer
    .replace(/[\\r\\n][\\s\\S]*$/, '')
    .replace(/^\\u001B\\[200~/, '')
    .replace(/\\u001B\\[201~$/, '');
  if (!line.startsWith('/goal ')) {
    process.stderr.write('fake codex received ordinary chat instead of a /goal command\\n');
    process.exit(6);
  }

  if (!line.includes('Create a researched GitHub issue for Casino Warehouse')) {
    process.stderr.write('fake codex received the wrong generated goal\\n');
    process.exit(7);
  }

  process.stdout.write('Goal active Objective: Create a researched\\n');
  setTimeout(() => process.exit(0), 25);
});
process.stdin.resume();
`,
      );
      chmodSync(codexShim, 0o755);

      const result = runLauncher('start-codex.sh', ['create-issue', 'launcher goal truncates after generated command'], {
        env: { CODEX_BIN: 'codex', CODEX_GOAL_KEY_DELAY_MS: '0', PATH: `${binDir}:${process.env.PATH}` },
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('error: Codex exited before exposing the complete generated /goal objective.');
    } finally {
      rmSync(binDir, { force: true, recursive: true });
    }
  }, 45_000);

  it('rejects invalid generated-goal key delay values', () => {
    const binDir = mkdtempSync(join(tmpdir(), 'casino-launcher-delay-'));

    try {
      const codexShim = join(binDir, 'codex');
      writeFileSync(codexShim, '#!/bin/sh\nexit 0\n');
      chmodSync(codexShim, 0o755);

      const result = runLauncher('start-codex.sh', ['issue', '128'], {
        env: { CODEX_BIN: 'codex', CODEX_GOAL_KEY_DELAY_MS: 'fast', PATH: `${binDir}:${process.env.PATH}` },
      });

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('error: CODEX_GOAL_KEY_DELAY_MS must be a non-negative integer.');
    } finally {
      rmSync(binDir, { force: true, recursive: true });
    }
  });

  it('keeps the expect flow and readiness pattern in the shared helper', () => {
    const issueLauncher = readFileSync(join(repoRoot, launcherScript('start-codex-issue.sh')), 'utf8');
    const triageLauncher = readFileSync(join(repoRoot, launcherScript('start-codex-triage-issue.sh')), 'utf8');
    const issueDependenciesLauncher = readFileSync(join(repoRoot, launcherScript('start-codex-issue-dependencies.sh')), 'utf8');
    const prLauncher = readFileSync(join(repoRoot, launcherScript('start-codex-pr-review.sh')), 'utf8');
    const securityLauncher = readFileSync(join(repoRoot, launcherScript('start-codex-security-pass.sh')), 'utf8');
    const centralLauncher = readFileSync(join(repoRoot, 'start-codex.sh'), 'utf8');
    const helper = readFileSync(join(repoRoot, '.agents/scripts/codex-goal-launcher.sh'), 'utf8');

    expect(issueLauncher).not.toContain('cat >"$expect_script"');
    expect(triageLauncher).not.toContain('cat >"$expect_script"');
    expect(issueDependenciesLauncher).not.toContain('cat >"$expect_script"');
    expect(prLauncher).not.toContain('cat >"$expect_script"');
    expect(securityLauncher).not.toContain('cat >"$expect_script"');
    expect(centralLauncher).not.toContain('cat >"$expect_script"');
    expect(helper).toContain('-re {·[^\\r\\n]*(~|/)}');
    expect(helper).toContain('CODEX_GOAL_KEY_DELAY_MS');
    expect(helper).toContain('make_goal_tui_safe');
    expect(helper).toContain('{\\$(casino-[[:alnum:]_-]+)}');
    expect(helper).toContain('the \\1 skill');
    expect(helper).toContain('goal_objective_from_command');
    expect(helper).toContain('goal_confirmation_matches');
    expect(helper).toContain('CASINO_CODEX_GOAL_STATE_VERIFY');
    expect(helper).toContain('resize_spawn_tty $tty_rows $handoff_columns');
    expect(helper).toContain('send -- "\\033\\[200~"');
    expect(helper).toContain('send -- "\\033\\[201~"');
    expect(helper).toContain('exit_interactive 130');
    expect(helper).toContain('send_goal_text $goal_command $key_delay_ms');
    expect(helper).toContain('Refusing to continue because the active goal may be truncated.');
    expect(helper).not.toContain('send -s -- "$goal"');
  });

  it('keeps launcher scripts syntactically valid bash', () => {
    const rootLaunchers = readdirSync(repoRoot)
      .filter((name) => name.startsWith('start-codex') && name.endsWith('.sh'))
      .sort();
    expect(rootLaunchers).toEqual(['start-codex.sh']);

    const agentScripts = readdirSync(join(repoRoot, '.agents/scripts'))
      .filter((name) => name.endsWith('.sh'))
      .map((name) => join('.agents/scripts', name))
      .sort();
    const agentLaunchers = readdirSync(join(repoRoot, '.agents/launchers'))
      .filter((name) => name.startsWith('start-codex') && name.endsWith('.sh'))
      .map((name) => join('.agents/launchers', name))
      .sort();

    for (const script of [...rootLaunchers, ...agentScripts, ...agentLaunchers]) {
      const result = spawnSync(process.env.BASH ?? '/bin/bash', ['-n', join(repoRoot, script)], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    }
  });
});
