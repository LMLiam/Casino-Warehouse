---
name: casino-issue-completion
description: Use for Casino Warehouse issue or PR completion, readiness, review, update, stale-branch, and merge-check work. Enforces PR-first evidence review, review comments, checks, and base freshness before ready.
---

# Casino Warehouse Issue Completion

You may not describe an issue or pull request as complete, ready, ready to merge, done, or finished until this workflow is complete on the current PR head.

This skill is mandatory for issue completion, PR updates, stale branch updates, review-fix requests, resumed goals, and "is this ready?" checks.

## Core Rule

No evidence, no readiness.

A self-review is invalid unless it happens against the opened or updated pull request, names the files inspected, the diff range reviewed, the risks checked, the commands run, and the review findings.

The review must be a real pull request code review, not just a checklist pass. It must inspect the changed files and related context for correctness, security, performance, maintainability, architecture, tests, and documentation.

Pre-PR diff inspection is useful for implementation hygiene, but it does not satisfy the required review evidence. Readiness review begins only after a pull request exists, because actionable findings must be left as pull request review comments when repository permissions allow.

After a pull request exists, every self-review finding must be commented before it is fixed. Do not edit, commit, or push a fix for a self-review finding until the PR review comment exists and its URL or comment ID is recorded, unless comment creation failed and the exact attempted tool or command plus exact failure has already been recorded.

## Required Evidence

Before the final response, collect:

- current branch name
- target branch name
- target branch commit SHA
- current HEAD commit SHA
- issue number, if known
- pull request number, if known
- changed files from `git diff --name-only <target>...HEAD`
- uncommitted working tree status
- commands run, with pass/fail status
- files inspected during self-review
- risks checked during self-review
- review findings
- review verdict: `APPROVE`, `REQUEST_CHANGES`, or `NEEDS_DISCUSSION`
- web/current-info verification performed, or a statement that no review claim depended on current external facts
- PR comments created, or exact reason comments could not be created
- for each review finding: PR comment URL or ID, fix commit SHA if fixed, and resolution reply URL or ID when available
- fixes pushed after review, if any
- CI/check status after the latest pushed commit
- whether the current branch is up to date with the target branch

## Review Scope

Choose the review scope before reviewing:

- PR diff: default for issue completion and readiness checks once a pull request exists
- branch diff: implementation sanity check before opening or updating a pull request
- staged or unstaged diff: only when reviewing local work before commit
- specific files: when the user asks about named paths
- directory or subsystem: when a change spans a cohesive area
- focused pass: add a security, performance, or architecture pass when the issue, files, or risk profile calls for it

For large diffs, break the review into focused file or subsystem passes and aggregate the findings before deciding readiness.

## Required Review Lenses

For each changed file and the related code needed to understand it, review:

- purpose of the change and whether it matches the issue or PR intent
- correctness bugs, edge cases, breaking changes, and API compatibility
- security vulnerabilities and sensitive-data handling
- performance implications, resource usage, and concurrency risks
- maintainability, code organization, coupling, duplication, and complexity
- test coverage gaps, deterministic fixture use, and documentation needs
- repository-specific rules from `AGENTS.md`, `CONTRIBUTING.md`, `docs/code-quality.md`, and `docs/supply-chain-security.md`

Security review must consider, when relevant:

- SQL or command injection
- authentication and authorization flaws
- sensitive data exposure, hardcoded secrets, and token leakage
- insecure deserialization
- XSS and CSRF
- insecure dependencies
- improper input validation
- missing rate limiting
- verbose error messages
- insecure configuration
- missing security headers

Performance review must consider, when relevant:

- algorithmic complexity and unnecessary nested loops
- inefficient data structures
- memory leaks, unclosed resources, and large allocations
- N+1 or excessive I/O patterns
- synchronous blocking calls
- missing caching opportunities
- race conditions, deadlocks, and thread or event-loop safety

Architecture review must consider, when relevant:

- domain boundaries and module ownership
- design patterns and anti-patterns
- single-responsibility and dependency-inversion issues
- circular dependencies and unnecessary coupling
- code duplication, complex functions, and missing abstractions

## Finding Format

Every finding must include:

- location: file path and line number where possible
- severity: `critical`, `high`, `medium`, `low`, or `info`
- category: `bug`, `security`, `performance`, `maintainability`, `architecture`, `test`, or `documentation`
- description: what is wrong and why it matters
- suggestion: the concrete remediation, with a code example when useful
- blocking status: whether it must be fixed before the PR is ready

Report findings in severity order. Required changes are blocking; suggested improvements and questions are non-blocking unless they hide a concrete correctness or safety risk.

## Current Information Verification

Before making any review claim about current external facts, verify it with web search and cite the source in the review notes. This applies to:

- latest versions of tools, libraries, runtimes, or frameworks
- deprecation status
- security advisories, CVEs, or current vulnerability guidance
- current best practices
- feature availability by release version

Do not guess or rely on memory for these claims. If no finding depends on current external facts, state that no web/current-info verification was needed.

## Mandatory Workflow

1. Read repository guidance:
   - `AGENTS.md`
   - `README.md`
   - `CONTRIBUTING.md`
   - `GOVERNANCE.md`
   - `docs/code-quality.md`
   - `docs/supply-chain-security.md`
   - `.github/PULL_REQUEST_TEMPLATE.md`

2. Identify the issue or pull request being completed.

3. Inspect the current branch, target branch, and working tree:
   - `git branch --show-current`
   - `git status --short`
   - `git rev-parse HEAD`
   - `git fetch origin`
   - identify the target branch, normally `origin/main`

4. Do the requested implementation work.

5. Run the narrowest meaningful checks while iterating.

6. Before opening or updating the PR, run an implementation sanity pass:
   - `git diff <target>...HEAD`
   - `git diff --check <target>...HEAD`
   - `git diff --name-only <target>...HEAD`
   - inspect every changed source, test, config, workflow, and documentation file relevant to the work

7. Open or update the pull request:
   - fill in every required section of `.github/PULL_REQUEST_TEMPLATE.md`
   - include the commands run and their pass/fail status
   - link the issue being completed when applicable
   - add at least one `type:*` label and one `area:*` label
   - keep the pull request draft while the required review loop is still in progress
   - preserve generated build output out of the commit

8. After the PR exists, run `bash .agents/skills/casino-issue-completion/scripts/pr-readiness.sh <target>`.

9. After the PR exists, run `bash .agents/skills/casino-issue-completion/scripts/pr-review-files.sh <target>`.

10. Treat `pr-review-files.sh` classifications as a prioritization aid, not as proof that any file can be skipped. Review the opened or updated pull request like a maintainer with the required review lenses above. This PR review is the required self-review evidence; a pre-PR branch inspection cannot replace it. Check purpose and correctness of each changed file; bug and edge-case risks; security, performance, architecture, and maintainability risks; domain ownership; the one-exported-top-level-element rule; absence of vague utility modules; game, payout, and bankroll authority staying out of UI; multiplayer credential and token leakage; persistence schema and runtime-boundary safety; deterministic tests where relevant; generated build output not committed; workflow action pinning if workflows changed; PR template completeness; and issue labels, PR labels, milestone, and linked issue when applicable.

11. For every issue found during PR review:
    - stop before editing any file related to the finding
    - leave a pull request review comment when repository permissions allow, preferably inline on the affected file and line
    - record the review comment URL or ID in your working notes
    - only after the comment exists, fix the issue
    - push the fix and record the fix commit SHA
    - respond to or resolve the review thread where possible, and record the resolution reply URL or ID when available
    - if comment creation fails, record the attempted tool or command and exact failure before editing; then report the finding locally and proceed only through the documented fallback path

12. After every new commit, rebase, merge from target, force-push, PR body edit that reruns checks, or resolved-comment action, repeat steps 8 through 11 on the current pull request head.

13. Verify the branch is up to date with the target branch. Do not rely on mergeability alone.

14. Verify required checks pass on the latest HEAD.

15. Mark a draft pull request ready for review only after the PR review loop, base freshness check, and required checks are complete.

16. Only then provide a final readiness status.

## If PR Comments Cannot Be Created

Do not skip the review.

Record the attempted tool or command and the exact failure before editing any fix for the finding.

Instead, produce local review findings in the final response using file paths and line-level references where possible.

State clearly why PR comments could not be created.

## Final Response Format

Use this format exactly:

```txt
PR:
Issue:
Current branch:
Current HEAD:
Target branch:
Target commit:
Changed files reviewed:
Commands run:
CI/check status:
Review verdict:
Current-info verification:
Review comments:
Fixes after review:
Remaining risks:
Status:
```

The `Status` line must be one of:

- `Ready`
- `Not ready`
- `Blocked`

Do not use `Ready` unless all mandatory evidence is present, the branch is current with the target branch, required checks pass on the latest HEAD, and the latest self-review found no unresolved issues.
