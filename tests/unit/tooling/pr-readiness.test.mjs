import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const scriptPath = join(repositoryRoot, '.agents/skills/casino-issue-completion/scripts/pr-readiness.sh');
const validatorPath = join(repositoryRoot, 'scripts/validate-pr-standards.mjs');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  return result.stdout.trim();
}

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), 'casino-pr-readiness-'));
  const origin = join(root, 'origin.git');
  const repo = join(root, 'repo');

  run('git', ['init', '--bare', origin]);
  run('git', ['init', repo]);
  run('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  run('git', ['config', 'user.name', 'Test User'], { cwd: repo });
  run('git', ['switch', '-c', 'main'], { cwd: repo });
  run('git', ['remote', 'add', 'origin', origin], { cwd: repo });

  mkdirSync(join(repo, 'scripts'), { recursive: true });
  copyFileSync(validatorPath, join(repo, 'scripts/validate-pr-standards.mjs'));
  writeFileSync(join(repo, 'README.md'), '# Test repo\n');
  run('git', ['add', '.'], { cwd: repo });
  run('git', ['commit', '-m', 'initial'], { cwd: repo });
  run('git', ['push', '-u', 'origin', 'main'], { cwd: repo });
  run('git', ['switch', '-c', 'issue-129-pr-readiness-github'], { cwd: repo });
  writeFileSync(join(repo, 'tooling-note.md'), 'readiness helper change\n');
  run('git', ['add', 'tooling-note.md'], { cwd: repo });
  run('git', ['commit', '-m', 'change readiness helper'], { cwd: repo });

  return {
    head: run('git', ['rev-parse', 'HEAD'], { cwd: repo }),
    repo,
    root,
  };
}

function writeFakeGh(root, source) {
  const bin = join(root, 'bin');
  const gh = join(bin, 'gh');

  mkdirSync(bin, { recursive: true });
  writeFileSync(gh, source, { mode: 0o755 });

  return bin;
}

function runReadiness(repo, bin, args = ['origin/main'], env = {}) {
  return spawnSync('bash', [scriptPath, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
      GITHUB_REPOSITORY: 'LMLiam/Casino-Warehouse',
      PATH: `${bin}:${process.env.PATH}`,
    },
  });
}

const readinessTestTimeoutMs = 45_000;

describe('pr-readiness.sh', () => {
  it(
    'preserves local target-ref evidence when no pull request is resolved',
    () => {
      const { repo, root } = createRepository();
      const bin = writeFakeGh(
        root,
        `#!/usr/bin/env node
console.error('no pull requests found for branch');
process.exit(1);
`,
      );

      const result = runReadiness(repo, bin);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('== Local git evidence ==');
      expect(result.stdout).toContain('Target fetch status:\nfetched latest refs from origin before evaluating target freshness');
      expect(result.stdout).toContain('Changed files:\ntooling-note.md');
      expect(result.stdout).toContain('== GitHub PR evidence ==');
      expect(result.stdout).toContain('No pull request evidence was resolved.');
      expect(result.stdout).toContain('Action: pass a PR number or branch name');
    },
    readinessTestTimeoutMs,
  );

  it(
    'does not fall back to the current branch when an explicit PR number fails',
    () => {
      const { head, repo, root } = createRepository();
      const bin = writeFakeGh(
        root,
        `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'pr' && args[1] === 'view' && args[2] === '137') {
  console.error('HTTP 404: pull request not found');
  process.exit(1);
}
if (args[0] === 'pr' && args[1] === 'view' && args[2] === 'issue-129-pr-readiness-github') {
  console.log(JSON.stringify({
    number: 999,
    url: 'https://github.com/LMLiam/Casino-Warehouse/pull/999',
    title: 'chore(agents): wrong fallback',
    state: 'OPEN',
    isDraft: true,
    baseRefName: 'main',
    baseRefOid: process.env.FAKE_PR_HEAD,
    headRefName: 'issue-129-pr-readiness-github',
    headRefOid: process.env.FAKE_PR_HEAD,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    labels: [],
    milestone: null,
    closingIssuesReferences: [],
    body: '',
  }));
  process.exit(0);
}
console.error('unexpected gh invocation: ' + args.join(' '));
process.exit(1);
`,
      );

      const result = runReadiness(repo, bin, ['137'], { FAKE_PR_HEAD: head });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Target input note:\ninput '137' did not resolve as a PR or local Git ref; using origin/main for local evidence");
      expect(result.stdout).toContain('No pull request evidence was resolved.');
      expect(result.stdout).not.toContain('PR number: 999');
      expect(result.stdout).not.toContain('https://github.com/LMLiam/Casino-Warehouse/pull/999');
    },
    readinessTestTimeoutMs,
  );

  it(
    'does not fall back to the current branch when an explicit local branch selector fails',
    () => {
      const { head, repo, root } = createRepository();
      run('git', ['branch', 'feature/readiness-target', 'origin/main'], { cwd: repo });
      const bin = writeFakeGh(
        root,
        `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'pr' && args[1] === 'view' && args[2] === 'feature/readiness-target') {
  console.error('no pull requests found for branch');
  process.exit(1);
}
if (args[0] === 'pr' && args[1] === 'view' && args[2] === 'issue-129-pr-readiness-github') {
  console.log(JSON.stringify({
    number: 999,
    url: 'https://github.com/LMLiam/Casino-Warehouse/pull/999',
    title: 'chore(agents): wrong branch fallback',
    state: 'OPEN',
    isDraft: true,
    baseRefName: 'main',
    baseRefOid: process.env.FAKE_PR_HEAD,
    headRefName: 'issue-129-pr-readiness-github',
    headRefOid: process.env.FAKE_PR_HEAD,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    labels: [],
    milestone: null,
    closingIssuesReferences: [],
    body: '',
  }));
  process.exit(0);
}
console.error('unexpected gh invocation: ' + args.join(' '));
process.exit(1);
`,
      );

      const result = runReadiness(repo, bin, ['feature/readiness-target'], { FAKE_PR_HEAD: head });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Target branch:\nfeature/readiness-target');
      expect(result.stdout).toContain('No pull request evidence was resolved.');
      expect(result.stdout).not.toContain('PR number: 999');
      expect(result.stdout).not.toContain('https://github.com/LMLiam/Casino-Warehouse/pull/999');
    },
    readinessTestTimeoutMs,
  );

  it(
    'reports live GitHub PR evidence, checks, and unresolved review threads for a resolved PR',
    () => {
      const { head, repo, root } = createRepository();
      const bin = writeFakeGh(
        root,
        `#!/usr/bin/env node
const args = process.argv.slice(2);
const validBody = \`## Summary

Enhances the readiness helper so issue-completion review can collect local and GitHub PR evidence from one command.

## Type

- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Refactor
- [x] Test or tooling

## Checks

- [x] I read \\\`CONTRIBUTING.md\\\`.
- [x] I kept generated build output out of this pull request.
- [x] I added or updated tests, or explained why tests are not needed.
- [x] I ran the relevant local checks.

## Testing

Commands run:

\\\`\\\`\\\`text
npm run test -- tests/unit/tooling/pr-readiness.test.mjs
\\\`\\\`\\\`

## Notes

N/A\`;

if (args[0] === 'pr' && args[1] === 'view') {
  const selector = args[2];
  if (selector !== 'issue-129-pr-readiness-github') {
    console.error('no pull requests found for selector');
    process.exit(1);
  }

  console.log(JSON.stringify({
    number: 246,
    url: 'https://github.com/LMLiam/Casino-Warehouse/pull/246',
    title: 'chore(agents): verify live PR readiness evidence',
    state: 'OPEN',
    isDraft: true,
    baseRefName: 'main',
    baseRefOid: process.env.FAKE_PR_HEAD,
    headRefName: 'issue-129-pr-readiness-github',
    headRefOid: process.env.FAKE_PR_HEAD,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    labels: [{ name: 'type:maintenance' }, { name: 'area:tooling' }],
    milestone: { title: '06 - Repository/community health' },
    closingIssuesReferences: [{ number: 129, title: 'maintenance(agents): make PR readiness helper verify live GitHub evidence' }],
    body: validBody,
  }));
  process.exit(0);
}

if (args[0] === 'pr' && args[1] === 'checks') {
  console.log(JSON.stringify([
    { name: 'Required Quality Gate', state: 'SUCCESS', bucket: 'pass', link: 'https://example.test/checks/1', workflow: 'Project Checks' },
  ]));
  process.exit(0);
}

if (args[0] === 'api' && args[1] === 'graphql') {
  console.log(JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: 'PRRT_kwDOtest',
                isResolved: false,
                path: '.agents/skills/casino-issue-completion/scripts/pr-readiness.sh',
                line: 42,
                comments: {
                  nodes: [
                    {
                      id: 'PRRC_kwDOtest',
                      url: 'https://github.com/LMLiam/Casino-Warehouse/pull/246#discussion_r1',
                      author: { login: 'reviewer' },
                      body: 'Please verify this branch.',
                    },
                  ],
                },
              },
              {
                id: 'PRRT_kwDOresolved',
                isResolved: true,
                path: 'README.md',
                line: 1,
                comments: { nodes: [] },
              },
            ],
          },
        },
      },
    },
  }));
  process.exit(0);
}

console.error('unexpected gh invocation: ' + args.join(' '));
process.exit(1);
`,
      );

      const result = runReadiness(repo, bin, ['origin/main'], { FAKE_PR_HEAD: head });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('PR selector resolved:\nissue-129-pr-readiness-github');
      expect(result.stdout).toContain('PR URL: https://github.com/LMLiam/Casino-Warehouse/pull/246');
      expect(result.stdout).toContain('Labels: type:maintenance, area:tooling');
      expect(result.stdout).toContain('Milestone: 06 - Repository/community health');
      expect(result.stdout).toContain('Linked closing issues: #129 maintenance(agents): make PR readiness helper verify live GitHub evidence');
      expect(result.stdout).toContain('PR template and metadata validator: pass');
      expect(result.stdout).toContain('Local HEAD matches PR head SHA?\nyes');
      expect(result.stdout).toContain('Required checks for PR head');
      expect(result.stdout).toContain('- Required Quality Gate (Project Checks): SUCCESS https://example.test/checks/1');
      expect(result.stdout).toContain('Review threads: 1 unresolved of 2 fetched');
      expect(result.stdout).toContain('PRRT_kwDOtest .agents/skills/casino-issue-completion/scripts/pr-readiness.sh:42 by reviewer');
    },
    readinessTestTimeoutMs,
  );

  it(
    'reports required check JSON when gh exits nonzero for pending checks',
    () => {
      const { head, repo, root } = createRepository();
      const bin = writeFakeGh(
        root,
        `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'pr' && args[1] === 'view') {
  console.log(JSON.stringify({
    number: 246,
    url: 'https://github.com/LMLiam/Casino-Warehouse/pull/246',
    title: 'chore(agents): verify live PR readiness evidence',
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'main',
    baseRefOid: process.env.FAKE_PR_HEAD,
    headRefName: 'issue-129-pr-readiness-github',
    headRefOid: process.env.FAKE_PR_HEAD,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'BLOCKED',
    labels: [{ name: 'type:maintenance' }, { name: 'area:tooling' }],
    milestone: { title: '06 - Repository/community health' },
    closingIssuesReferences: [],
    body: '## Summary\\n\\nThis pull request has enough detail for the metadata validator.\\n\\n## Type\\n\\n- [x] Test or tooling\\n\\n## Checks\\n\\n- [x] I read \`CONTRIBUTING.md\`.\\n- [x] I kept generated build output out of this pull request.\\n- [x] I added or updated tests, or explained why tests are not needed.\\n- [x] I ran the relevant local checks.\\n\\n## Testing\\n\\nCommands run:\\n\\n\`\`\`text\\nnpm run test -- tests/unit/tooling/pr-readiness.test.mjs\\n\`\`\`\\n\\n## Notes\\n\\nN/A',
  }));
  process.exit(0);
}
if (args[0] === 'pr' && args[1] === 'checks') {
  console.log(JSON.stringify([
    { name: 'Required Quality Gate', state: 'PENDING', bucket: 'pending', link: 'https://example.test/checks/1', workflow: 'Project Checks' },
  ]));
  process.exit(8);
}
if (args[0] === 'api' && args[1] === 'graphql') {
  console.log(JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [] } } } } }));
  process.exit(0);
}
console.error('unexpected gh invocation: ' + args.join(' '));
process.exit(1);
`,
      );

      const result = runReadiness(repo, bin, ['origin/main'], { FAKE_PR_HEAD: head });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('- Required Quality Gate (Project Checks): PENDING https://example.test/checks/1');
      expect(result.stdout).toContain('gh pr checks exit status: 8');
      expect(result.stdout).not.toContain('warning: unable to fetch required checks');
    },
    readinessTestTimeoutMs,
  );
});
