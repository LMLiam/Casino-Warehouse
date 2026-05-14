---
name: casino-issue-creation
description: Create researched, repository-compliant GitHub issues for Casino Warehouse from user requests.
---

# Casino Warehouse Issue Creation

Use this skill when a user asks Codex to create, open, draft, file, or prepare a GitHub issue for Casino Warehouse.

The goal is not prompt-to-issue transcription. A good issue should give a future implementer enough context to understand the problem, avoid duplicate work, choose a plausible implementation path, and verify the result.

## Scope Rules

- Keep Casino Warehouse in its noncommercial fictional-money scope. Do not create issues that add deposits, withdrawals, payments, crypto, NFTs, cash-out flows, or commercial casino positioning.
- Clarify only when the request is too ambiguous to make a useful issue. If the request is clear enough, research first and proceed.
- Do not invent evidence. Separate facts found in repository files, issues, pull requests, logs, or commands from your own implementation suggestions.
- Web-verify before making current external claims about versions, deprecations, CVEs, advisories, best practices, or feature availability. If no current external claim is needed, say so in the final evidence summary.

## Required Repository Context

Before creating the issue, read the relevant parts of:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `README.md`
- `docs/code-quality.md`
- `docs/supply-chain-security.md` when security, workflows, dependencies, or repository automation may be involved

Also inspect the files, tests, scripts, workflows, docs, or source areas that are likely to be affected by the requested issue. Prefer `rg` and focused file reads over broad browsing.

## Duplicate And Related Work Search

Search existing open and closed issues and pull requests before creating anything. Use several query shapes:

- the user's key nouns and verbs
- likely feature or bug names from the codebase
- relevant file, script, workflow, or subsystem names
- synonyms a maintainer may have used

Record the search terms and whether each hit was a duplicate, related work, or not relevant. If a duplicate exists, do not open a new issue unless the user explicitly asks for a follow-up issue with a distinct scope.

## Issue Planning Workflow

1. Restate the user request as a concrete issue topic.
2. Search issues and pull requests for duplicates or close relatives.
3. Inspect repository context and likely affected files.
4. Identify the most likely issue type, area label, status label, and milestone.
5. Decide whether the issue is `status:ready` or `status:needs-triage`.
6. Draft a repository-compliant issue title and body.
7. Create the issue through GitHub.
8. Verify the created issue number, URL, title, labels, milestone, and body.
9. Report the issue and evidence summary.

## Status And Milestone Selection

Use `status:ready` only when the researched issue has clear acceptance criteria and enough context for implementation. Ready issues need:

- one `type:*` label
- one `area:*` label
- one `status:*` label
- a milestone
- clear acceptance criteria or next action

Use `status:needs-triage` when maintainer input is still needed for product direction, scope, priority, milestone, design choice, security tradeoff, or acceptance criteria. Explain the missing decision in the issue's open questions.

Use `status:blocked` only when a specific dependency, repository setting, external service, or preceding issue prevents useful work.

## Metadata Rules

Issue titles must use `type(scope): summary`. Supported title types are documented in `CONTRIBUTING.md`; common choices are `feature`, `bug`, `maintenance`, `docs`, `test`, `ci`, `security`, `deps`, and `question`.

Labels must include at least:

- one `type:*`
- one `area:*`
- one `status:*`

Choose a milestone for `status:ready` issues based on `GOVERNANCE.md` milestone order. Leave the milestone unset for `status:needs-triage` unless the repository context clearly points to one.

## Issue Body Shape

Every researched issue body should include:

```md
## Problem or opportunity

## Proposed solution or implementation notes

## Acceptance criteria

## Likely touched files or subsystems

## Testing expectations

## Open questions
```

Use `None.` for `## Open questions` only when the issue is clear enough for `status:ready`.

For bug reports, also include the repository-required bug sections when evidence is available:

```md
## Summary

## Steps to reproduce

## Expected behaviour

## Actual behaviour
```

If a section cannot be filled because the user request lacks evidence, say what information is missing and choose `status:needs-triage`.

## Implementation Notes To Include

When relevant, call out:

- likely touched files, scripts, docs, workflows, source domains, or tests
- expected testing level, including unit, server/client, Playwright, shell syntax, lint, or documentation-only reasoning
- edge cases and compatibility concerns
- security, privacy, token, authorization, multiplayer, persistence, workflow, or supply-chain risks
- documentation impact
- out-of-scope noncommercial gambling or payment-related changes

## Creating And Verifying The Issue

Create issues with GitHub tooling available in the environment, such as the GitHub app or `gh issue create`.

After creation, fetch the issue and verify:

- issue number and URL
- title
- labels
- milestone
- body sections
- `status:ready` issues have acceptance criteria and a milestone
- duplicate-search and file-inspection evidence is recorded in your final response

## Final Response

Keep the final response concise and evidence-backed:

```txt
Issue:
Title:
Labels:
Milestone:
Status rationale:
Duplicate search:
Files inspected:
Current-info verification:
Notes:
```

If the issue could not be created, report the exact attempted command or tool and failure.
