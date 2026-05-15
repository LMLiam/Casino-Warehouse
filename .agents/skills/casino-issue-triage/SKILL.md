---
name: casino-issue-triage
description: Triage existing Casino Warehouse GitHub issues into repository-compliant, implementation-ready shape.
---

# Casino Warehouse Issue Triage

Use this skill when a user asks Codex to triage, groom, clarify, label, milestone, de-duplicate, decline, block, or ready an existing Casino Warehouse GitHub issue.

This workflow improves issue quality. It must not perform implementation work, open an implementation pull request, or make code changes unless the user explicitly changes the goal to issue completion.

## Core Rules

- Do not invent evidence. Separate repository facts, GitHub issue or pull request facts, command output, and maintainer-facing recommendations.
- Do not mark an issue `status:ready` unless the issue has enough context for a later `$casino-issue-completion` run.
- Search for duplicates and related work before changing issue metadata or body text.
- Inspect repository files when the issue scope depends on current behaviour, scripts, workflows, docs, source layout, tests, security controls, or agent workflows.
- Keep Casino Warehouse in fictional-money, noncommercial scope. Do not triage issues toward deposits, withdrawals, payments, crypto, NFTs, cash-out flows, or commercial casino positioning.
- Web-verify before making current external claims about versions, deprecations, CVEs, advisories, best practices, or feature availability. If no current external claim is needed, say so in the final report.

## Required Repository Context

Before changing an issue, read the relevant parts of:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `README.md`
- `docs/code-quality.md`
- `docs/supply-chain-security.md` when security, workflows, dependencies, repository automation, or supply-chain controls may be involved

Also inspect the files, tests, scripts, workflows, docs, or source areas named by the issue or likely to be affected. Prefer `rg` and focused file reads over broad browsing.

## Duplicate And Related Work Search

Search open and closed issues and pull requests before changing metadata or status. Use several query shapes:

- the issue title nouns and verbs
- likely feature, bug, script, workflow, or source names from the repository
- relevant labels, milestones, and subsystem names
- synonyms a maintainer may have used

Record the exact search terms, notable hits, and whether each hit is a duplicate, related work, prerequisite, follow-up, or not relevant. If the issue is a duplicate, prefer `status:duplicate` or closure guidance instead of making it ready.

## Triage Workflow

1. Fetch the issue and record its current title, state, labels, milestone, body, comments, and URL.
2. Search existing issues and pull requests for duplicates, prerequisites, blockers, or related work.
3. Read repository guidance and inspect affected files or docs.
4. Decide whether the issue needs body edits, labels, milestone, comments, closure, or no change.
5. Choose the status label based on the evidence.
6. Update the issue only when the evidence supports the change.
7. Verify the updated issue title, state, labels, milestone, body, and URL from GitHub.
8. Report the before/after metadata, duplicate search, files inspected, changes made, and unresolved questions.

## Status Selection

Use `status:needs-triage` when a maintainer decision is still needed for product direction, scope, priority, milestone, design choice, security tradeoff, acceptance criteria, or ownership.

Use `status:ready` only when the issue has:

- at least one `type:*` label
- at least one `area:*` label
- exactly one appropriate `status:*` label
- a milestone
- clear acceptance criteria
- a concrete next action
- enough repository context for a future implementer to start without re-triaging

Use `status:blocked` when a specific dependency prevents useful work, such as another issue, a repository setting, a required maintainer decision, an external service, or unavailable credentials. Name the blocker in the issue body or a comment.

Use `status:duplicate` when another issue or pull request already covers the same actionable work. Link the canonical issue or pull request and explain whether this issue should close or remain as a related note.

Use `status:declined` when the request is outside scope, unsafe, commercially oriented, inconsistent with the license or noncommercial demo goals, or no longer planned. Leave a concise rationale before closing or recommending closure.

## Metadata Rules

Issue titles should use `type(scope): summary`. Supported issue title types are documented in `CONTRIBUTING.md`; common choices are `feature`, `bug`, `maintenance`, `docs`, `test`, `ci`, `security`, `deps`, and `question`.

Labels must include at least:

- one `type:*`
- one `area:*`
- one `status:*`

Avoid conflicting status labels. If changing status, replace the old `status:*` label rather than adding a second one.

Ready issues need a milestone selected from the sequence in `GOVERNANCE.md`. Leave the milestone unset for `status:needs-triage` unless existing maintainer context clearly points to one.

## Body And Comment Guidance

When improving an issue body, preserve useful reporter details and add missing structure instead of overwriting evidence. A ready issue should make these points clear:

```md
## Problem or opportunity

## Proposed solution or implementation notes

## Acceptance criteria

## Likely touched files or subsystems

## Testing expectations

## Open questions
```

Use `None.` for `## Open questions` only when the issue is clear enough for `status:ready`.

For bug issues, preserve or add the repository-required bug context when evidence exists:

```md
## Summary

## Steps to reproduce

## Expected behaviour

## Actual behaviour
```

If the issue body is already clear, a triage comment may be better than rewriting it. Use comments for rationale, duplicate links, blockers, or maintainer questions that do not belong in the issue body.

## Final Response

Keep the final response concise and evidence-backed:

```txt
Issue URL:
Labels/milestone before:
Labels/milestone after:
Duplicate search:
Files inspected:
Changes made:
Current-info verification:
Unresolved questions:
Next action:
```

If GitHub updates could not be made, report the exact attempted command or tool and failure, then state the local recommendation.
