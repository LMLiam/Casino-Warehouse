---
name: casino-issue-dependency-audit
description: Audit Casino Warehouse GitHub issues for evidence-backed blockers, downstream dependencies, sequencing notes, duplicate dependency records, and maintainer-clarification needs.
---

# Casino Issue Dependency Audit

Use this skill when a user asks Codex to audit, map, review, sort, clarify, update, or report dependency relationships between existing Casino Warehouse GitHub issues.

This workflow maps issue relationships. It must not implement code changes, close issues, deprioritize work, or re-scope issues unless a maintainer explicitly asks for that action.

## Core Rules

- Do not invent dependencies. Every blocker, downstream relationship, sequencing note, stale relationship, and maintainer question must be backed by issue bodies, comments, linked pull requests, labels, milestones, repository guidance, or maintainer statements.
- Review every open issue before producing a dependency map. A focused user request may prioritize one milestone or label, but the audit must still check the remaining open issues for dependency or sequencing relationships before mutating metadata.
- Treat milestone order as planning context, not proof of blocking. Earlier milestone work blocks later work only when there is concrete evidence that the later issue cannot proceed until the earlier issue, decision, external service, or repository setting is resolved.
- Use `status:blocked` only when a specific blocker prevents useful work. Preferred ordering, shared context, or lower priority stays `status:ready` when the issue is otherwise actionable.
- Keep Casino Warehouse in fictional-money, noncommercial scope. Do not steer issue dependencies toward deposits, withdrawals, payments, crypto, NFTs, cash-out flows, or commercial casino positioning.
- Web-verify before making current external claims about versions, deprecations, CVEs, advisories, best practices, feature availability, or external service availability. If no current external claim is needed, say so in the final report.

## Required Repository Context

Before mutating issue metadata, bodies, or comments, read the relevant parts of:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `GOVERNANCE.md`

Also read `README.md`, `docs/code-quality.md`, `docs/supply-chain-security.md`, local agent skills, launcher scripts, workflows, source files, tests, or docs named by the issues being audited when they affect dependency decisions.

## Issue Inventory

List open issues before deciding relationships. Group or filter the inventory by:

- milestone, including unassigned issues
- status label
- type label
- area label
- priority label when present

Useful commands include:

```bash
gh issue list --state open --limit 200 --json number,title,labels,milestone,assignees,updatedAt,url
gh issue list --state open --label status:blocked --limit 200 --json number,title,labels,milestone,url
gh issue list --state open --milestone "06 - Repository/community health" --limit 200 --json number,title,labels,url
```

If the repository has more open issues than the command limit, paginate or narrow by milestone until every open issue has been reviewed.

## Evidence Review

For each open issue:

1. Read the title, body, labels, milestone, state, assignees, comments, and URL.
2. Identify explicit dependency phrases such as `blocked by`, `blocks`, `depends on`, `prerequisite`, `waiting for`, `after #123`, `before #123`, `supersedes`, or `duplicate`.
3. Search issue comments and linked pull requests when the issue body or comments mention related work, blockers, stalled decisions, failed checks, repository settings, external services, or follow-up pull requests.
4. Search other issues and pull requests for reverse references to the issue number and likely dependency keywords.
5. Compare the issue's milestone with `GOVERNANCE.md` milestone order before deciding whether a relationship is a true blocker or preferred order.
6. Record whether the issue is blocked, blocking another issue, sequenced but ready, unclear, duplicate/superseded/stale, or independent.

Prefer focused searches such as:

```bash
gh issue list --state all --search "#123 blocked OR blocks OR depends OR prerequisite"
gh pr list --state all --search "#123"
gh issue view 123 --comments --json number,title,body,labels,milestone,comments,url
```

## Dependency Categories

Use these categories consistently:

- `Hard blocker`: an issue, maintainer decision, external service, credential, repository setting, required check, or upstream fix prevents useful progress.
- `Downstream impact`: this issue blocks or materially gates another issue.
- `Preferred sequence`: work can proceed, but the repository would benefit from doing issues in a documented order.
- `Clarification needed`: evidence suggests a possible dependency, but the blocker, direction, or action is not decidable without maintainer input.
- `Duplicate or superseded relationship`: an old dependency note points at an issue or pull request that no longer applies, has been replaced, or has conflicting newer evidence.
- `Independent`: no dependency or sequencing relationship was found.

## Recording Convention

Prefer one canonical issue comment per audited issue when recording or updating dependency context. Use this marker at the top so future audits can update the same note instead of creating duplicates:

```md
<!-- casino-issue-dependency-audit -->

## Dependency notes

Blocked by:

- None.

Blocks:

- None.

Sequencing:

- None.

Clarification needed:

- None.

Evidence:

- Reviewed during dependency audit on YYYY-MM-DD.
```

When an issue already has a clear dependency section in its body, update that section only if the evidence supports the edit and the body is the maintained source of truth for the relationship. Otherwise, leave or update the canonical comment.

For hard blockers, record both directions when helpful to maintainers:

- On the blocked issue, write `Blocked by: #A because <evidence-backed reason>.`
- On the blocking issue, write `Blocks: #B because <evidence-backed downstream impact>.`

For preferred sequencing, avoid `status:blocked`. Write `Sequencing: Prefer #A before #B because <reason>; #B remains actionable.`

For maintainer clarification, write the concrete question, the evidence that made it ambiguous, and the issue or setting that needs a decision.

## Metadata Updates

Only update labels, milestones, bodies, or comments when the relationship is evidence-backed.

When marking an issue `status:blocked`:

- replace any conflicting `status:*` label instead of adding a second status label
- make the blocker visible in the issue body or canonical dependency comment
- name the blocking issue, maintainer decision, external dependency, repository setting, credential, or required check
- leave the issue open unless a maintainer explicitly asked for closure

When a blocked issue becomes ready:

- remove `status:blocked`
- add the appropriate next status, usually `status:ready` when acceptance criteria and milestone remain valid
- update or replace the stale dependency note with the evidence that the blocker cleared

When an issue blocks other work:

- leave a downstream note on the blocking issue when the context would help maintainers prioritize or batch work
- avoid `priority:high` unless repository guidance or maintainer evidence supports it

When a relationship is stale, duplicate, or superseded:

- update the canonical dependency comment or issue body section to remove or mark the stale relationship
- link the newer canonical issue or pull request when one exists
- record why the old dependency no longer applies

## Audit Workflow

1. Fetch current issue metadata and repository refs.
2. Read `AGENTS.md`, `CONTRIBUTING.md`, and `GOVERNANCE.md` before mutating any issue.
3. Build the open-issue inventory grouped by milestone, status, type, and area.
4. Review every open issue for explicit or implied dependency relationships.
5. Search comments, linked pull requests, reverse references, and likely duplicate or superseded relationships.
6. Classify each relationship as hard blocker, downstream impact, preferred sequence, clarification needed, duplicate/superseded/stale, or independent.
7. Decide metadata and comment/body updates from evidence only.
8. Apply updates with GitHub tooling when needed.
9. Verify each updated issue from GitHub after mutation.
10. Produce a maintainer-readable dependency map.

## Final Report

Keep the final report concise and evidence-backed:

```txt
Scope:
Repository context read:
Issue inventory:
Commands/API calls used:
Current-info verification:
Blocker relationships:
Downstream relationships:
Preferred sequencing:
Blocked status changes:
Canonical dependency notes updated:
Duplicate, superseded, or stale relationships:
Maintainer clarification needed:
Issues reviewed with no dependencies:
Skipped checks:
Residual risk:
Status:
```

The `Blocker relationships` section must list each hard blocker in both directions, for example:

```txt
- #A blocks #B: <reason and evidence>.
- #B is blocked by #A: <same relationship from the blocked issue's perspective>.
```

`Status` must be one of:

- `Audit complete`
- `Audit complete with updates`
- `Blocked`
