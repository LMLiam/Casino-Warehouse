---
name: casino-issue-completion
description: Use for Casino Warehouse issue or PR completion, readiness, review, update, stale-branch, and merge-check work. Enforces evidence-first self-review, PR comments, checks, and base freshness before ready.
---

# Casino Warehouse Issue Completion

You may not describe an issue or pull request as complete, ready, ready to merge, done, or finished until this workflow is complete on the current PR head.

This skill is mandatory for issue completion, PR updates, stale branch updates, review-fix requests, resumed goals, and "is this ready?" checks.

## Core Rule

No evidence, no readiness.

A self-review is invalid unless it names the files inspected, the diff range reviewed, the risks checked, the commands run, and the review findings.

The review must be a real code review, not just a checklist pass. It must inspect the changed files and related context for correctness, security, performance, maintainability, architecture, tests, and documentation.

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
- fixes pushed after review, if any
- CI/check status after the latest pushed commit
- whether the current branch is up to date with the target branch

## Review Scope

Choose the review scope before reviewing:

- branch or PR diff: default for issue completion and readiness checks
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

6. Before opening or updating the PR, inspect the diff:
   - `git diff <target>...HEAD`
   - `git diff --check <target>...HEAD`
   - `git diff --name-only <target>...HEAD`
   - inspect every changed source, test, config, workflow, and documentation file relevant to the work

7. Run `bash .agents/skills/casino-issue-completion/scripts/pr-readiness.sh <target>`.

8. Run `bash .agents/skills/casino-issue-completion/scripts/pr-review-files.sh <target>`.

9. Self-review the actual changed files with the required review lenses above. Check at least:
   - purpose and correctness of each changed file
   - bug and edge-case risks
   - security risks from the security review list
   - performance risks from the performance review list
   - architecture and maintainability risks from the architecture review list
   - domain ownership
   - one-exported-top-level-element rule
   - absence of vague utility modules
   - game/payout/bankroll authority staying out of UI
   - multiplayer credential/token leakage
   - persistence schema/runtime boundary safety
   - deterministic tests where relevant
   - generated build output not committed
   - workflow action pinning if workflows changed
   - PR template completeness if a PR exists
   - issue labels, PR labels, milestone, and linked issue when applicable

10. For every issue found during self-review:
    - leave a PR review comment when repository permissions allow
    - fix the issue
    - push the fix
    - respond to or resolve the review thread where possible

11. After every new commit, rebase, merge from target, force-push, PR body edit that reruns checks, or resolved-comment action, repeat steps 6 through 10.

12. Verify the branch is up to date with the target branch. Do not rely on mergeability alone.

13. Verify required checks pass on the latest HEAD.

14. Only then provide a final readiness status.

## If PR Comments Cannot Be Created

Do not skip the review.

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
