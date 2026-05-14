import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const scriptPath = join(repositoryRoot, '.agents/skills/casino-issue-completion/scripts/pr-review-files.sh');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  return result.stdout.trim();
};

const writeFile = (root, path, contents = 'fixture\n') => {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
};

const createRepository = (files) => {
  const repo = mkdtempSync(join(tmpdir(), 'casino-pr-review-files-'));

  run('git', ['init', repo]);
  run('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  run('git', ['config', 'user.name', 'Test User'], { cwd: repo });
  run('git', ['switch', '-c', 'main'], { cwd: repo });
  writeFile(repo, 'README.md', '# Test repo\n');
  run('git', ['add', '.'], { cwd: repo });
  run('git', ['commit', '-m', 'initial'], { cwd: repo });
  run('git', ['switch', '-c', 'classifier-fixtures'], { cwd: repo });

  for (const file of files) {
    writeFile(repo, file);
  }

  run('git', ['add', '.'], { cwd: repo });
  run('git', ['commit', '-m', 'add classifier fixtures'], { cwd: repo });

  return repo;
};

const runReviewFiles = (repo) =>
  spawnSync('bash', [scriptPath, 'main'], {
    cwd: repo,
    encoding: 'utf8',
  });

describe('pr-review-files.sh', () => {
  it('classifies representative tooling, config, GitHub, UI, asset, and test files', () => {
    const expectedClassifications = new Map([
      ['.agents/skills/casino-issue-completion/SKILL.md', '[agent skill/workflow]'],
      ['.agents/scripts/codex-goal-launcher.sh', '[agent launcher/tooling]'],
      ['.github/CODEOWNERS', '[GitHub repository config]'],
      ['.github/ISSUE_TEMPLATE/bug_report.yml', '[issue template/triage config]'],
      ['.github/PULL_REQUEST_TEMPLATE.md', '[pull request template/metadata]'],
      ['.github/dependabot.yml', '[dependabot/dependency automation]'],
      ['.github/workflows/ci.yml', '[workflow: check action pinning and required checks]'],
      ['.npmrc', '[tooling/config]'],
      ['.prettierrc', '[tooling/config]'],
      ['eslint.config.js', '[tooling/config]'],
      ['package-lock.json', '[dependency/runtime script surface]'],
      ['playwright.config.ts', '[tooling/config]'],
      ['public/assets/slots/symbols/lotus.png', '[asset manifest/static asset: check provenance and paths]'],
      ['scripts/dev-cloudflare.mjs', '[tooling script: check CLI behavior and subprocess/file safety]'],
      ['src/assets/manifest.ts', '[asset manifest/static asset: check provenance and paths]'],
      ['src/styles/main.css', '[UI styles: check layout, responsiveness, and accessibility]'],
      ['start-codex-issue.sh', '[agent launcher/tooling]'],
      ['tests/unit/tooling/pr-review-files.fixture.mjs', '[code/test]'],
      ['vite.config.ts', '[tooling/config]'],
    ]);
    const repo = createRepository([...expectedClassifications.keys()]);

    try {
      const result = runReviewFiles(repo);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Classifications are a prioritization aid; inspect every changed file');

      for (const [file, classification] of expectedClassifications) {
        expect(result.stdout).toContain(`- ${file} ${classification}`);
      }

      expect(result.stdout).not.toContain('[inspect if relevant]');
    } finally {
      rmSync(repo, { force: true, recursive: true });
    }
  });
});
