---
name: casino-pr-full-review
description: Review Casino Warehouse pull requests end to end. Use when Codex is asked to review, approve, request changes, audit readiness, assess over-engineering, leave inline review comments, or produce evidence-backed PR review findings for this repository.
---

# Casino PR Full Review

## Overview

Use this skill for maintainer-style Casino Warehouse PR reviews. It complements `.agents/skills/casino-issue-completion/SKILL.md`; load that skill too whenever the user asks whether a PR is complete, ready, mergeable, fixed, updated, or otherwise finished.

The output of this skill is a real PR review: changed files inspected, related context checked, local/CI evidence recorded, inline review comments left when possible, and a clear verdict.

## Workflow

1. Confirm the review target:
   - Identify the PR number, repository, base branch, head branch, base SHA, and head SHA.
   - Fetch PR metadata, body, changed files, prior reviews, unresolved threads when available, and CI/check status for the current head.
   - If the user mentions a concern such as "over-engineered", keep it as a review lens rather than as a predetermined finding.

2. Prepare a review workspace:
   - Prefer a separate worktree or branch checkout for full local inspection.
   - Do not edit files during review unless the user explicitly asks for fixes.
   - Preserve unrelated user changes and report any local dirty state that affects the review.

3. Load required repository context:
   - Read `AGENTS.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `docs/code-quality.md`, `docs/supply-chain-security.md`, and `.github/PULL_REQUEST_TEMPLATE.md`.
   - For readiness or completion claims, run the issue-completion evidence scripts after the PR exists:
     - `bash .agents/skills/casino-issue-completion/scripts/pr-readiness.sh <target>`
     - `bash .agents/skills/casino-issue-completion/scripts/pr-review-files.sh <target>`

4. Review the full changed surface:
   - Inspect every changed source, test, script, config, workflow, dependency, and documentation file.
   - Read related code needed to understand behavior, not only the patch hunks.
   - Check purpose fit, correctness, edge cases, security, performance/resource handling, architecture/domain boundaries, maintainability, tests, docs, generated-output hygiene, PR metadata, labels, linked issue, and base freshness.
   - Treat implementation intent as insufficient evidence. Only claim behavior is covered when supported by code, tests, CI, logs, generated output, or an executable command.

5. Evaluate complexity carefully:
   - Call out over-engineering only when it creates concrete risk: fragile state, hidden coupling, duplicated authority, untestable paths, misleading recovery promises, unnecessary dependencies, or maintenance burden.
   - Separate taste from blockers. Mark suggestions and simplifications as non-blocking unless they hide a correctness, security, or reliability issue.
   - Prefer existing repo patterns over new abstractions unless the PR shows a real need.

6. Run evidence checks:
   - Run the narrowest meaningful local commands for the changed surface, plus cheap sanity checks such as `git diff --check`.
   - For docs-only or metadata-only reviews, explain why tests are not needed.
   - Verify GitHub CI/check status for the current PR head. Do not rely on stale status from an older commit.
   - Web-verify any claim about latest versions, CVEs, deprecations, security advisories, best practices, or feature availability. If no review claim needs current external facts, say so.

7. Leave PR comments:
   - Use inline file comments for actionable code or documentation findings whenever possible.
   - Include severity, category, blocking status, why it matters, and a concrete remediation.
   - Submit `REQUEST_CHANGES` when blocking findings remain, `APPROVE` when no blockers remain, and `COMMENT` for neutral or permission-limited reviews.
   - If GitHub rejects approval or request-changes on the user's own PR, submit a `COMMENT` review and record the exact rejection.
   - If inline comments cannot be created, record the attempted tool or command and exact failure, then report file/line findings in the final response.

## Finding Shape

Use this structure for review findings:

- Location: path and line, preferably a PR diff line
- Severity: `critical`, `high`, `medium`, `low`, or `info`
- Category: `bug`, `security`, `performance`, `maintainability`, `architecture`, `test`, or `documentation`
- Blocking: `yes` or `no`
- Problem: what is wrong and why it matters
- Suggestion: the concrete fix or simplification

Avoid vague review comments such as "consider simplifying this" unless they explain the actual failure mode or maintenance cost.

## Final Response

For a completed PR review, report:

- PR number and title
- Issue number when known
- Local branch/worktree, target branch, target SHA, head SHA
- Changed files reviewed
- Commands run and pass/fail status
- CI/check status for the current head
- Review verdict
- Current-info verification used, or why none was needed
- Inline comments created with URLs or IDs, or exact failure
- Remaining blockers, non-blocking notes, and residual risk

Lead with findings when the user asked for a review. Keep the summary short after the issues.
