---
name: casino-security-review
description: Run focused, evidence-backed Casino Warehouse security reviews for pull requests, branches, issues, subsystems, or named files.
---

# Casino Security Review

Use this skill when a user asks for a security pass, threat-model-style review, public tunnel audit, auth/token audit, dependency or workflow security review, or focused review of security-sensitive Casino Warehouse code.

This skill finds and explains security risk. It does not replace `.agents/skills/casino-pr-full-review/SKILL.md` for full pull request review, and it does not replace `.agents/skills/casino-issue-completion/SKILL.md` when the user asks whether a pull request or issue is complete, ready, fixed, updated, or mergeable.

## Scope Rules

- Keep Casino Warehouse in its fictional-money, noncommercial demo scope. Do not recommend deposits, withdrawals, payments, crypto, NFTs, cash-out flows, commercial casino positioning, or production gambling operations.
- Treat public tunnel sessions as trusted demos, not production hosting.
- Separate confirmed vulnerabilities from hardening suggestions, missing evidence, and residual risks.
- Do not make broad security claims without evidence from code, tests, CI, logs, generated output, or current external sources.
- Do not weaken CodeQL, Dependency Review, action pinning, branch protection, WebSocket origin protection, public tunnel origin checks, profile ownership checks, admin-token protection, or other existing security controls.
- Web-verify before making claims about current vulnerabilities, advisories, CVEs, deprecations, latest versions, supported versions, feature availability, or current best practices.
- If no review claim depends on current external facts, state that no current-info verification was needed.

## Review Targets

The target can be a pull request, branch diff, issue, subsystem, directory, or named file list.

Before reviewing, identify and record:

- target type and target name or number
- base branch and base commit when reviewing a diff
- head branch and head commit when reviewing a diff
- exact files, directories, or commits inspected
- related tests and security controls inspected
- local working tree status if a checkout is used

For pull requests, fetch PR metadata, changed files, prior security-related comments, and current check status before relying on local evidence. For branch or local reviews, inspect the relevant diff and related code.

## Required Repository Context

Read the relevant parts of:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `README.md`
- `SECURITY.md`
- `docs/code-quality.md`
- `docs/supply-chain-security.md`
- `.github/PULL_REQUEST_TEMPLATE.md` when reviewing a PR
- `.github/workflows/` when workflows, CodeQL, Dependency Review, Scorecard, or action pins are in scope

Also inspect related source, schema, tests, scripts, and docs for the selected target. Reviewing only the changed lines is not enough when security behavior depends on surrounding authorization, validation, persistence, or protocol code.

## Casino-Specific Security Checklist

Review the items that are relevant to the target:

- `CASINO_ADMIN_TOKEN` is required for destructive admin actions and is not logged, stored in public URLs, broadcast, or exposed through public state.
- Profile tokens and browser-local profile credentials are never included in public `data-state`, room lists, room snapshots, logs, invite links, or broadcast messages.
- Server-created profile ownership is enforced for rename, delete, save, host, and join operations; a public `profileId` is not treated as permission.
- Public `data-state` attributes expose only display-safe state.
- Room snapshots and realtime protocol messages exclude admin capability, profile tokens, and other credentials.
- WebSocket origin policy accepts local development origins and the configured trusted public base URL while rejecting unexpected public origins.
- Public tunnel configuration derives invite links and browser WebSocket URLs from trusted runtime configuration without bypassing origin checks.
- Server authority owns multiplayer settlement, bankroll mutations, room lifecycle, and admin mutations; UI code does not recompute or override authoritative outcomes.
- Persistence boundaries validate runtime input and persisted envelopes before trusting server data.
- Dependency changes do not introduce known vulnerable packages, insecure overrides, or lockfile drift.
- GitHub Actions remain pinned to full 40-character SHAs with same-line version comments.
- CodeQL, Dependency Review, Scorecard, branch protection, and required checks are preserved or strengthened.
- Error messages, logs, and diagnostics do not leak credentials, tokens, filesystem secrets, or sensitive configuration.

## Current-Info Verification

Use current external sources when a finding or recommendation depends on:

- vulnerability advisories, CVEs, malware reports, or dependency security status
- deprecation, end-of-life, or supported-version claims
- current secure-use guidance or best practices
- feature availability in a specific tool, framework, platform, or GitHub security feature

Prefer official project, vendor, GitHub, npm, NVD, GitHub Advisory Database, or OpenSSF documentation. Record the source URL, date checked, and the exact claim it supports. Do not cite a source for a broader claim than it actually supports.

## Required Review Lenses

For each relevant file and related context, check:

- authentication, authorization, and capability boundaries
- token, secret, profile credential, and admin capability exposure
- input validation, schema parsing, and persistence safety
- WebSocket, public tunnel, browser storage, and CORS or origin behavior
- multiplayer room authority, race conditions, replay risk, and state consistency
- XSS risks from HTML rendering, public state, invite links, and user-controlled labels
- dependency, workflow, action pinning, CodeQL, Dependency Review, and supply-chain controls
- tests that prove the intended control works and fail for the risky behavior
- documentation accuracy for public demos, tokens, local storage, tunnels, and residual risk

## Evidence Expectations

Before recommending a change, inspect the existing control and related tests when they exist. A recommendation to replace, relax, or move a control is not valid unless the review explains:

- what the existing control does
- what evidence shows it is insufficient
- how the suggested change preserves or strengthens the control
- which tests, CI checks, logs, or manual commands support the recommendation
- what residual risk remains

## Finding Format

Report each finding in severity order using this shape:

- Location: file path and line number where possible
- Severity: `critical`, `high`, `medium`, `low`, or `info`
- Category: `security`, `bug`, `test`, `documentation`, `architecture`, `maintainability`, or `performance`
- Status: `confirmed vulnerability`, `hardening suggestion`, `residual risk`, or `needs more evidence`
- Blocking: `yes` or `no`
- Exploit or failure mode: how the risk can be triggered or why it matters
- Evidence: code, test, CI, log, command, or current-info source that supports the finding
- Suggested fix: concrete remediation that preserves existing security controls

Confirmed vulnerabilities need direct evidence of an exploitable or policy-breaking behavior. Hardening suggestions should explain why they are defense-in-depth rather than proof of a current vulnerability. Residual risks should name what remains after existing controls.

## Workflow

1. Confirm the target and whether the user wants review only or also wants fixes.
2. Read the required repository context for the target.
3. Fetch current PR, issue, branch, and check evidence when the target is on GitHub.
4. Inspect the target diff or files and related security controls.
5. Inspect related tests, fixtures, scripts, workflows, schemas, and docs.
6. Run the narrowest useful checks for the reviewed surface, or explain why commands were not run.
7. Web-verify any current external security, version, advisory, CVE, deprecation, or best-practice claim.
8. Produce findings with evidence and concrete remediation.
9. If the user asked for fixes, implement only evidence-backed changes, preserve existing controls, and then run relevant checks again.

## Useful Commands

Adapt these commands to the target:

```bash
git status --short --branch
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run supply-chain:check
npm run lint
npm run test -- tests/unit/multiplayer/multiplayer-server.test.ts
npm run visual -- --project=laptop tests/e2e/multiplayer-flow.spec.ts tests/e2e/public-tunnel-smoke.spec.ts
gh pr view <pr> --json number,url,title,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,mergeStateStatus,labels,closingIssuesReferences,body
gh pr checks <pr> --required --json name,state,bucket,link,workflow
```

Use the smallest command that gives meaningful evidence. For docs-only or skill-only reviews, shell syntax validation, formatting, lint, and focused unit tests may be enough.

## Final Report

Use this report shape:

```txt
Target:
Scope reviewed:
Base/head or files reviewed:
Commands run:
Current-info sources:
Findings:
Confirmed vulnerabilities:
Hardening suggestions:
Residual risks:
Unresolved assumptions:
Status:
```

`Status` must be one of:

- `No confirmed vulnerabilities found`
- `Findings need fixes`
- `Fixes implemented; verification passing`
- `Blocked`
