---
name: casino-ci-failure-review
description: Diagnose failing Casino Warehouse pull request checks with GitHub evidence, local reproduction guidance, and an explicit fix approval gate.
---

# Casino CI Failure Review

Use this skill when a user asks Codex to inspect, explain, diagnose, review, retry, or fix failing GitHub checks for a Casino Warehouse pull request or the pull request for the current branch.

This skill complements `.agents/skills/casino-issue-completion/SKILL.md` and `.agents/skills/casino-pr-full-review/SKILL.md`. It makes red checks understandable and actionable; it is not a substitute for the full PR review loop before an issue or pull request is called ready.

## Scope Rules

- Diagnose first. Do not jump from a red check to speculative edits.
- Use current GitHub evidence from the pull request, check rollup, workflow runs, failed jobs, and logs.
- Distinguish required checks from informational checks and from external providers.
- Implement fixes only when the user explicitly asks for a fix, or when the active goal clearly includes fixing CI.
- If a fix is implemented for an open PR, also follow the issue-completion workflow before calling the PR ready.
- Do not rerun jobs unless the evidence points to flaky infrastructure or a stale transient failure, and explain why a rerun is safer than a code change.
- Web-verify before making current external claims about versions, deprecations, CVEs, advisories, best practices, or feature availability.

## Required Repository Context

Read the relevant parts of:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/code-quality.md` when failures involve lint, typecheck, architecture, source boundaries, tests, or generated output
- `docs/supply-chain-security.md` when failures involve workflows, dependencies, Dependency Review, Scorecard, CodeQL, action pins, or security posture
- `.github/workflows/` for the failing workflow definitions

## Required Evidence

Collect and report:

- PR number, URL, title, base branch, head branch, and head SHA
- Whether the branch head has changed while diagnosing
- Required check names, states, URLs, and workflows
- Full check rollup when useful for distinguishing required and informational checks
- Relevant workflow run IDs, attempts, event names, conclusions, and head SHAs
- Failed job names, job IDs, step names, conclusions, and log snippets
- Commands or tools used to fetch evidence
- Local reproduction commands run, with pass/fail status, or why they were skipped
- Classification for each failure
- Proposed fix path, retry path, or maintainer-input path
- Residual risk and any evidence gap

## Required Check Contexts

Recognize these repository-required contexts:

- `Required Quality Gate`
- `Analyze (javascript-typescript)`
- `Validate Pull Request Metadata`
- `Review Dependency Changes`

GitHub may display the aggregate quality gate as `Project Checks / Required Quality Gate`. Its prerequisites can include:

- `Project Checks / Quality, Coverage, and Server Build`
- `Project Checks / Visual and E2E (Laptop Visual)`
- `Project Checks / Visual and E2E (Tablet Visual)`
- `Project Checks / Visual and E2E (Laptop Multiplayer)`

Treat CodeQL, Dependency Review, PR metadata validation, and the aggregate required quality gate as merge-blocking when they are required for the latest PR head.

## Workflow

1. Identify the PR:
   - If a PR number was provided, use it.
   - Otherwise, resolve the pull request for the current branch.
   - Record the current local branch and dirty state when local checkout is used.

2. Fetch PR metadata:
   - Fetch PR number, URL, title, state, draft status, base branch, base SHA, head branch, head SHA, labels, linked issues, and merge state.
   - Confirm that the local checkout, if any, matches or can fetch the PR head before relying on local reproduction.

3. Fetch check evidence:
   - Use `gh pr checks <pr> --required --json name,state,bucket,link,workflow` for required checks.
   - Use the full check rollup or GitHub API when required-vs-informational status is unclear.
   - Use `gh run list --commit <head-sha>` or equivalent API calls to find workflow runs for the current head SHA.
   - Use `gh run view <run-id> --json jobs,conclusion,event,headSha,name,status,url` and job logs for failed jobs.
   - For external providers, record the details URL and classify them as external; do not invent log evidence the repo cannot access.

4. Inspect failing workflow definitions and related scripts:
   - Read the workflow file for each failing run.
   - Read any repo script, test, config, or validation module invoked by the failing step.
   - For workflow changes, verify external actions remain pinned to full 40-character SHAs with same-line version comments.

5. Classify each failure:
   - `code regression`: source or test evidence points to changed behavior breaking a required expectation
   - `test expectation drift`: the product behavior changed intentionally but tests, snapshots, or fixtures were not updated correctly
   - `flaky infrastructure`: timeout, network, service, runner, browser download, or intermittent resource issue without matching local/code evidence
   - `dependency or security gate`: Dependency Review, npm audit-like gate, pinned action, package lock, CodeQL, or supply-chain policy failure
   - `PR metadata issue`: title, labels, template, linked issue, draft/metadata, or issue-standard validation failure
   - `external provider issue`: a non-GitHub provider failed or is inaccessible from repo evidence
   - `needs maintainer input`: the evidence is insufficient or the path requires repository settings, secrets, branch protection, or product direction

6. Map local reproduction:
   - `Project Checks / Quality, Coverage, and Server Build`: `npm run lint`, `npm run format`, `npm run test:coverage`, and `npm run build:server` as applicable to the failed step.
   - `Visual and E2E (Laptop Visual)`: `npm run visual -- --project=laptop tests/e2e/casino-visual.spec.ts`
   - `Visual and E2E (Tablet Visual)`: `npm run visual -- --project=tablet tests/e2e/casino-visual.spec.ts`
   - `Visual and E2E (Laptop Multiplayer)`: `npm run visual -- --project=laptop tests/e2e/multiplayer-flow.spec.ts tests/e2e/public-tunnel-smoke.spec.ts`
   - `Validate Pull Request Metadata`: inspect `.github/workflows/pr-standards.yml`, `scripts/validate-pr-standards.mjs`, the PR title, labels, template body, and linked issue.
   - `Review Dependency Changes`: inspect `.github/workflows/dependency-review.yml`, `package.json`, `package-lock.json`, and Dependency Review output.
   - `Analyze (javascript-typescript)`: inspect `.github/workflows/codeql.yml`, CodeQL annotations, SARIF/upload steps when relevant, and changed TypeScript/JavaScript paths.

7. Decide and act:
   - If the user only requested diagnosis, stop at the evidence-backed report.
   - If the user requested a fix or the active goal includes fixing CI, make the narrowest evidence-backed fix, run the relevant local reproduction checks, push when requested, and then re-check GitHub status for the new head.
   - If the best next step is retry, rerun only the failed job or failed run when permitted and record the command and result.
   - If maintainer input or repository settings are required, report the blocker clearly.

## Useful Commands

Use commands like these, adapting the PR number and run IDs:

```bash
gh pr view <pr> --json number,url,title,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,mergeStateStatus,labels,closingIssuesReferences,body
gh pr checks <pr> --required --json name,state,bucket,link,workflow
gh pr checks <pr> --json name,state,bucket,link,workflow
gh run list --commit <head-sha> --json databaseId,name,headSha,status,conclusion,event,url,createdAt,updatedAt
gh run view <run-id> --json name,headSha,event,status,conclusion,url,jobs
gh run view <run-id> --job <job-id> --log
```

Prefer `gh run view --job <job-id> --log` for the smallest relevant log. Keep log snippets short and quote only the lines needed to prove the diagnosis.

## Report Format

Use this report shape:

```txt
PR:
Head SHA:
Required checks:
Failing checks:
Failure classification:
Evidence inspected:
Local reproduction:
Diagnosis:
Proposed fix path:
Current-info verification:
Residual risk:
Status:
```

`Status` must be one of:

- `Diagnosed`
- `Fix implemented; checks pending`
- `Fix implemented; checks passing`
- `Retry recommended`
- `Blocked`
