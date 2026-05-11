import { describe, expect, it } from 'vitest';
import {
  affectedFiles,
  buildAutofixBranchName,
  buildPullRequestBody,
  buildPullRequestTitle,
  createDraftAutofixPullRequest,
  createGitHubClient,
  findExistingFixPullRequest,
  optionsFromEnvironment,
  parseCliArguments,
  planAutofixPullRequests,
  requestAutofix,
  runAutofixAutomation,
} from '../../../scripts/codeql-autofix-prs.mjs';

const alert = ({ most_recent_instance: mostRecentInstance = {}, rule: ruleOverrides = {}, ...overrides } = {}) => ({
  html_url: `https://github.com/LMLiam/Casino-Warehouse/security/code-scanning/${overrides.number ?? 1}`,
  most_recent_instance: {
    location: { path: 'src/app/example.ts' },
    ref: 'refs/heads/main',
    ...mostRecentInstance,
  },
  number: 1,
  rule: {
    description: 'Insecure randomness',
    id: 'js/insecure-randomness',
    security_severity_level: 'high',
    severity: 'warning',
    ...ruleOverrides,
  },
  state: 'open',
  ...overrides,
});

describe('CodeQL Autofix automation planning', () => {
  it('selects open default-branch CodeQL alerts above the severity threshold', () => {
    const result = planAutofixPullRequests({
      alerts: [alert()],
      defaultBranch: 'main',
      openPullRequests: [],
      options: { minSeverity: 'high' },
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      branchName: 'security/autofix/alert-1-js-insecure-randomness',
      labels: ['type:maintenance', 'area:tooling', 'security'],
      title: 'security(codeql): autofix insecure randomness',
    });
  });

  it('skips alerts that are closed, from another ref, below severity, or outside the allowlist', () => {
    const result = planAutofixPullRequests({
      alerts: [
        alert({ number: 1, state: 'fixed' }),
        alert({ most_recent_instance: { ref: 'refs/pull/2/merge' }, number: 2 }),
        alert({ number: 3, rule: { security_severity_level: 'medium' } }),
        alert({ number: 4, rule: { id: 'js/xss', security_severity_level: 'high' } }),
      ],
      defaultBranch: 'main',
      openPullRequests: [],
      options: { allowRules: ['js/insecure-randomness'], minSeverity: 'high' },
    });

    expect(result.candidates).toEqual([]);
    expect(result.skipped.map((item) => item.reasons)).toEqual([['not-open'], ['not-default-branch'], ['below-min-severity'], ['rule-not-allowed']]);
  });

  it('deduplicates alerts already linked to an open fix pull request', () => {
    const targetAlert = alert({ number: 12 });
    const existing = {
      body: 'Fixes https://github.com/LMLiam/Casino-Warehouse/security/code-scanning/12',
      head: { ref: 'security/autofix/alert-12-js-insecure-randomness' },
      title: 'security(codeql): autofix insecure randomness',
    };

    expect(findExistingFixPullRequest(targetAlert, [existing])).toBe(existing);

    const result = planAutofixPullRequests({
      alerts: [targetAlert],
      defaultBranch: 'main',
      openPullRequests: [existing],
    });
    expect(result.candidates).toEqual([]);
    expect(result.skipped[0].reasons).toContain('existing-open-fix-pr');
  });

  it('rate limits candidates per run', () => {
    const result = planAutofixPullRequests({
      alerts: [alert({ number: 1 }), alert({ number: 2 }), alert({ number: 3 })],
      defaultBranch: 'main',
      openPullRequests: [],
      options: { maxAlerts: 2 },
    });

    expect(result.candidates.map((item) => item.alert.number)).toEqual([1, 2]);
    expect(result.skipped.map((item) => item.reasons)).toEqual([['max-alerts-reached']]);
  });

  it('builds draft PR metadata with alert context and affected files', () => {
    const targetAlert = alert({ number: 7 });
    const body = buildPullRequestBody(targetAlert, {
      autofixDescription: 'Escape user-controlled markup before rendering.',
      instances: [{ location: { path: 'src/ui/render.ts' } }],
    });

    expect(buildAutofixBranchName(targetAlert)).toBe('security/autofix/alert-7-js-insecure-randomness');
    expect(buildPullRequestTitle(targetAlert)).toBe('security(codeql): autofix insecure randomness');
    expect(affectedFiles(targetAlert, [{ location: { path: 'src/ui/render.ts' } }])).toEqual(['src/app/example.ts', 'src/ui/render.ts']);
    expect(body).toContain('https://github.com/LMLiam/Casino-Warehouse/security/code-scanning/7');
    expect(body).toContain('`js/insecure-randomness`');
    expect(body).toContain('Severity: high');
    expect(body).toContain('Escape user-controlled markup before rendering.');
    expect(body).toContain('Not run - draft Copilot Autofix PR generated for maintainer validation.');
  });

  it('builds safe fallback metadata when alert payload fields are missing', () => {
    const targetAlert = alert({
      html_url: undefined,
      most_recent_instance: { location: {} },
      number: 8,
      rule: { description: '', id: '!!!', security_severity_level: undefined, severity: 'warning' },
    });
    const body = buildPullRequestBody(targetAlert, { files: [], instances: [], autofixDescription: '   ' });

    expect(buildAutofixBranchName(targetAlert)).toBe('security/autofix/alert-8-rule');
    expect(buildPullRequestTitle(targetAlert)).toBe('security(codeql): autofix !!!');
    expect(body).toContain('- Alert: #8');
    expect(body).toContain('Severity: warning');
    expect(body).toContain('- Not reported by the alert payload');
    expect(body).toContain('Generated by GitHub Copilot Autofix. Review the committed diff before marking this draft ready.');
  });

  it('uses alternate alert payload fields and custom branch options', () => {
    const targetAlert = alert({
      html_url: undefined,
      number: 9,
      rule: {
        description: undefined,
        id: 'js/hardcoded-credentials',
        name: 'Hardcoded credentials',
        security_severity_level: undefined,
        severity: 'error',
      },
      url: 'https://api.github.com/repos/LMLiam/Casino-Warehouse/code-scanning/alerts/9',
    });
    const body = buildPullRequestBody(targetAlert, { files: ['src/secrets.ts'] });

    expect(buildAutofixBranchName(targetAlert, { branchPrefix: 'fix/codeql' })).toBe('fix/codeql/alert-9-js-hardcoded-credentials');
    expect(buildPullRequestTitle(targetAlert)).toBe('security(codeql): autofix hardcoded credentials');
    expect(body).toContain('- Alert: https://api.github.com/repos/LMLiam/Casino-Warehouse/code-scanning/alerts/9');
    expect(body).toContain('- Rule: `js/hardcoded-credentials` (Hardcoded credentials)');
    expect(body).toContain('- Severity: error');
    expect(body).toContain('- `src/secrets.ts`');
  });

  it('requests a supported Autofix before creating the branch and draft pull request', async () => {
    const targetAlert = alert({ number: 21 });
    const calls = [];
    const client = {
      paginate: async (path) => {
        calls.push(['paginate', path]);
        if (path.includes('/code-scanning/alerts?')) {
          return [targetAlert];
        }
        if (path.includes('/pulls?')) {
          return [];
        }
        if (path.includes('/instances?')) {
          return [{ location: { path: 'src/app/example.ts' } }];
        }
        throw new Error(`Unexpected paginate path: ${path}`);
      },
      request: async (method, path, body) => {
        calls.push([method, path, body]);
        if (method === 'POST' && path.endsWith('/code-scanning/alerts/21/autofix')) {
          return { data: { description: 'Replace insecure randomness with the game RNG.', status: 'success' } };
        }
        if (method === 'GET' && path.endsWith('/git/ref/heads/main')) {
          return { data: { object: { sha: 'base-sha' } } };
        }
        if (method === 'POST' && path.endsWith('/git/refs')) {
          return { data: { ref: body.ref } };
        }
        if (method === 'POST' && path.endsWith('/code-scanning/alerts/21/autofix/commits')) {
          return { data: { sha: 'fix-sha', target_ref: body.target_ref } };
        }
        if (method === 'POST' && path.endsWith('/pulls')) {
          return { data: { html_url: 'https://github.com/LMLiam/Casino-Warehouse/pull/44', number: 44 } };
        }
        if (method === 'POST' && path.endsWith('/issues/44/labels')) {
          return { data: [{ name: 'security' }] };
        }
        throw new Error(`Unexpected request: ${method} ${path}`);
      },
    };

    const result = await runAutofixAutomation({
      client,
      defaultBranch: 'main',
      mode: 'create',
      options: { maxAlerts: 1, minSeverity: 'high' },
      owner: 'LMLiam',
      repo: 'Casino-Warehouse',
    });

    const autofixIndex = calls.findIndex(([method, path]) => method === 'POST' && path.endsWith('/code-scanning/alerts/21/autofix'));
    const branchIndex = calls.findIndex(([method, path]) => method === 'POST' && path.endsWith('/git/refs'));
    const pullRequestCall = calls.find(([method, path]) => method === 'POST' && path.endsWith('/pulls'));

    expect(autofixIndex).toBeGreaterThan(-1);
    expect(branchIndex).toBeGreaterThan(autofixIndex);
    expect(pullRequestCall[2]).toMatchObject({
      draft: true,
      head: 'security/autofix/alert-21-js-insecure-randomness',
      title: 'security(codeql): autofix insecure randomness',
    });
    expect(pullRequestCall[2].body).toContain('Replace insecure randomness with the game RNG.');
    expect(result.created).toEqual([{ alert: 21, pullRequest: 'https://github.com/LMLiam/Casino-Warehouse/pull/44' }]);
    expect(result.failed).toEqual([]);
  });

  it('records unsupported Autofix failures without creating branches or pull requests', async () => {
    const targetAlert = alert({ number: 22 });
    const calls = [];
    const client = {
      paginate: async (path) => {
        calls.push(['paginate', path]);
        if (path.includes('/code-scanning/alerts?')) {
          return [targetAlert];
        }
        if (path.includes('/pulls?')) {
          return [];
        }
        throw new Error(`Unexpected paginate path: ${path}`);
      },
      request: async (method, path) => {
        calls.push([method, path]);
        if (method === 'POST' && path.endsWith('/code-scanning/alerts/22/autofix')) {
          throw new Error('POST autofix failed with 400: Autofix is not supported for this alert.');
        }
        throw new Error(`Unexpected request: ${method} ${path}`);
      },
    };

    const result = await runAutofixAutomation({
      client,
      defaultBranch: 'main',
      mode: 'create',
      options: { maxAlerts: 1, minSeverity: 'high' },
      owner: 'LMLiam',
      repo: 'Casino-Warehouse',
    });

    expect(calls.some(([method, path]) => method === 'POST' && path.endsWith('/git/refs'))).toBe(false);
    expect(calls.some(([method, path]) => method === 'POST' && path.endsWith('/pulls'))).toBe(false);
    expect(result.created).toEqual([]);
    expect(result.failed).toEqual([
      {
        alert: 22,
        branchName: 'security/autofix/alert-22-js-insecure-randomness',
        error: 'POST autofix failed with 400: Autofix is not supported for this alert.',
      },
    ]);
  });

  it('returns a dry-run plan without creating Autofix pull requests', async () => {
    const calls = [];
    const client = {
      paginate: async (path) => {
        calls.push(['paginate', path]);
        if (path.includes('/code-scanning/alerts?')) {
          return [alert({ number: 23 })];
        }
        if (path.includes('/pulls?')) {
          return [];
        }
        throw new Error(`Unexpected paginate path: ${path}`);
      },
      request: async (method, path) => {
        calls.push([method, path]);
        throw new Error(`Unexpected request: ${method} ${path}`);
      },
    };

    const result = await runAutofixAutomation({
      client,
      defaultBranch: 'main',
      mode: 'dry-run',
      options: { maxAlerts: 1, minSeverity: 'high' },
      owner: 'LMLiam',
      repo: 'Casino-Warehouse',
    });

    expect(result.candidates.map((candidate) => candidate.alert.number)).toEqual([23]);
    expect(result.created).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(calls.every(([method]) => method === 'paginate')).toBe(true);
  });

  it('polls pending Autofix requests until GitHub reports success', async () => {
    const calls = [];
    const client = {
      request: async (method, path) => {
        calls.push([method, path]);
        if (method === 'POST') {
          return { data: { status: 'pending' } };
        }
        return { data: { description: 'Use a safe sink.', status: 'success' } };
      },
    };

    await expect(
      requestAutofix({
        alertNumber: 24,
        client,
        options: { pollAttempts: 2, pollSeconds: 0 },
        owner: 'LMLiam',
        repo: 'Casino-Warehouse',
      }),
    ).resolves.toEqual({ description: 'Use a safe sink.', status: 'success' });
    expect(calls).toEqual([
      ['POST', '/repos/LMLiam/Casino-Warehouse/code-scanning/alerts/24/autofix'],
      ['GET', '/repos/LMLiam/Casino-Warehouse/code-scanning/alerts/24/autofix'],
    ]);
  });

  it('throws when Autofix ends with a failed status or times out', async () => {
    const failedClient = {
      request: async (method) => ({ data: { status: method === 'POST' ? 'pending' : 'failed' } }),
    };
    const pendingClient = {
      request: async () => ({ data: { status: 'pending' } }),
    };

    await expect(
      requestAutofix({
        alertNumber: 25,
        client: failedClient,
        options: { pollAttempts: 1, pollSeconds: 0 },
        owner: 'LMLiam',
        repo: 'Casino-Warehouse',
      }),
    ).rejects.toThrow('Autofix for alert 25 ended with status failed.');

    await expect(
      requestAutofix({
        alertNumber: 26,
        client: pendingClient,
        options: { pollAttempts: 1, pollSeconds: 0 },
        owner: 'LMLiam',
        repo: 'Casino-Warehouse',
      }),
    ).rejects.toThrow('Autofix for alert 26 did not finish within the polling limit.');
  });

  it('cleans up the generated branch when committing the Autofix fails before PR creation', async () => {
    const calls = [];
    const candidate = {
      alert: alert({ number: 27 }),
      branchName: 'security/autofix/alert-27-js-insecure-randomness',
      labels: ['security'],
      title: 'security(codeql): autofix insecure randomness',
    };
    const client = {
      paginate: async (path) => {
        calls.push(['paginate', path]);
        return [];
      },
      request: async (method, path, body) => {
        calls.push([method, path, body]);
        if (method === 'POST' && path.endsWith('/autofix')) {
          return { data: { description: 'Use stronger randomness.', status: 'success' } };
        }
        if (method === 'GET' && path.endsWith('/git/ref/heads/main')) {
          return { data: { object: { sha: 'base-sha' } } };
        }
        if (method === 'POST' && path.endsWith('/git/refs')) {
          return { data: { ref: body.ref } };
        }
        if (method === 'POST' && path.endsWith('/autofix/commits')) {
          throw new Error('commit failed');
        }
        if (method === 'DELETE' && path.endsWith('/git/refs/heads%2Fsecurity%2Fautofix%2Falert-27-js-insecure-randomness')) {
          return { data: undefined };
        }
        throw new Error(`Unexpected request: ${method} ${path}`);
      },
    };

    await expect(
      createDraftAutofixPullRequest({
        candidate,
        client,
        defaultBranch: 'main',
        options: { pollAttempts: 1, pollSeconds: 0 },
        owner: 'LMLiam',
        repo: 'Casino-Warehouse',
      }),
    ).rejects.toThrow('commit failed');
    expect(calls.some(([method, path]) => method === 'DELETE' && path.includes('/git/refs/heads%2Fsecurity%2Fautofix'))).toBe(true);
  });

  it('skips label calls when a generated pull request has no configured labels', async () => {
    const calls = [];
    const candidate = {
      alert: alert({ number: 28 }),
      branchName: 'security/autofix/alert-28-js-insecure-randomness',
      labels: [],
      title: 'security(codeql): autofix insecure randomness',
    };
    const client = {
      paginate: async (path) => {
        calls.push(['paginate', path]);
        return [];
      },
      request: async (method, path, body) => {
        calls.push([method, path, body]);
        if (method === 'POST' && path.endsWith('/autofix')) {
          return { data: { description: 'Use stronger randomness.', status: 'success' } };
        }
        if (method === 'GET' && path.endsWith('/git/ref/heads/main')) {
          return { data: { object: { sha: 'base-sha' } } };
        }
        if (method === 'POST' && path.endsWith('/git/refs')) {
          return { data: { ref: body.ref } };
        }
        if (method === 'POST' && path.endsWith('/autofix/commits')) {
          return { data: { sha: 'fix-sha', target_ref: body.target_ref } };
        }
        if (method === 'POST' && path.endsWith('/pulls')) {
          return { data: { html_url: 'https://github.com/LMLiam/Casino-Warehouse/pull/45', number: 45 } };
        }
        throw new Error(`Unexpected request: ${method} ${path}`);
      },
    };

    await expect(
      createDraftAutofixPullRequest({
        candidate,
        client,
        defaultBranch: 'main',
        options: { pollAttempts: 1, pollSeconds: 0 },
        owner: 'LMLiam',
        repo: 'Casino-Warehouse',
      }),
    ).resolves.toEqual({ alert: 28, pullRequest: 'https://github.com/LMLiam/Casino-Warehouse/pull/45' });
    expect(calls.some(([method, path]) => method === 'POST' && path.endsWith('/issues/45/labels'))).toBe(false);
  });

  it('parses CLI and environment configuration for conservative defaults and create mode', () => {
    expect(parseCliArguments(['--mode=create-draft-prs', '--allow-rules=js/xss,js/sql-injection', '--flag'])).toEqual(
      new Map([
        ['mode', 'create-draft-prs'],
        ['allow-rules', 'js/xss,js/sql-injection'],
        ['flag', 'true'],
      ]),
    );

    expect(
      optionsFromEnvironment(
        {
          AUTOFIX_LABELS: 'type:maintenance, area:tooling, security',
          AUTOFIX_MAX_ALERTS: '2',
          AUTOFIX_MIN_SEVERITY: 'medium',
          DEFAULT_BRANCH: 'trunk',
          GITHUB_API_URL: 'https://api.github.test',
          GITHUB_REPOSITORY: 'LMLiam/Casino-Warehouse',
          GITHUB_TOKEN: 'token',
        },
        ['--mode=create-draft-prs', '--allow-rules=js/xss', '--default-branch=main', '--max-alerts=1'],
      ),
    ).toMatchObject({
      apiUrl: 'https://api.github.test',
      defaultBranch: 'main',
      mode: 'create',
      options: {
        allowRules: ['js/xss'],
        labels: ['type:maintenance', 'area:tooling', 'security'],
        maxAlerts: 1,
        minSeverity: 'medium',
      },
      owner: 'LMLiam',
      repo: 'Casino-Warehouse',
      token: 'token',
    });

    expect(() => optionsFromEnvironment({}, [])).toThrow('Set GITHUB_REPOSITORY or pass --repo=OWNER/REPO.');
  });

  it('uses the GitHub REST client for JSON requests, pagination, and API errors', async () => {
    const fetchCalls = [];
    const fetchImpl = async (url, init) => {
      fetchCalls.push({ init, url });
      if (url.endsWith('/first')) {
        return {
          headers: new Headers({ link: '<https://api.github.com/second>; rel="next"' }),
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ id: 1 }]),
        };
      }
      if (url.endsWith('/second')) {
        return {
          headers: new Headers(),
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ id: 2 }]),
        };
      }
      if (url.endsWith('/empty')) {
        return {
          headers: new Headers(),
          ok: true,
          status: 204,
          text: async () => '',
        };
      }
      return {
        headers: new Headers(),
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'Forbidden' }),
      };
    };
    const client = createGitHubClient({ fetchImpl, token: 'token' });

    await expect(client.paginate('/first')).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    await expect(client.request('POST', '/empty', { ok: true })).resolves.toMatchObject({ data: undefined, status: 204 });
    await expect(client.request('GET', '/forbidden')).rejects.toThrow('GET /forbidden failed with 403: Forbidden');
    expect(fetchCalls[0].init.headers.Authorization).toBe('Bearer token');
    expect(fetchCalls[0].init.headers['X-GitHub-Api-Version']).toBe('2026-03-10');
    expect(fetchCalls[2].init.body).toBe(JSON.stringify({ ok: true }));
  });
});
