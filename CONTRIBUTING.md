# Contributing

Thanks for helping improve Casino Warehouse.

Casino Warehouse accepts changes through pull requests only. The `main` branch is protected, direct commits are blocked, and pull requests are merged with squash commits.

## Before You Start

- Read the [README](README.md) for local setup.
- Read the [license](LICENSE). Commercial use is not permitted.
- Check existing issues and pull requests before opening duplicates.
- Keep changes focused. Separate unrelated fixes into separate pull requests.

## Pull Request Rules

- Open a pull request from a branch or fork.
- Use the pull request template and fill in every required section.
- Use a conventional pull request title: `type(scope): summary`. Supported types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `security`, and `deps`.
- Add at least one `type:*` label and one `area:*` label.
- Include tests or a clear reason tests are not needed.
- Keep generated build output out of commits.
- Wait for CI and maintainer review.
- Do not commit directly to `main`; maintainers merge pull requests with squash commits.

## Security And Quality Gates

The `main` branch ruleset requires the CodeQL code scanning tool to report results before protected refs can update. The native code scanning gate blocks pull requests when CodeQL analysis is missing, still running, or reports a security alert at `high` severity or higher. The existing `Analyze (javascript-typescript)` status check remains required so the workflow result stays visible in the pull request checks list.

GitHub Code Quality is not enabled for this repository yet, so the ruleset does not currently enforce a Code Quality gate. When the `CodeQL - Code Quality / Analyze` check is available and passing on pull requests, maintainers should enable the native Code Quality ruleset requirement with an `Errors` threshold first. Contributors blocked by either gate should inspect the pull request checks and code scanning or Code Quality annotations, fix the reported finding, and push an updated commit.

## Local Checks

Configure your editor to respect the repository `.editorconfig` before making changes.

Run the relevant checks before requesting review:

```bash
npm install
npm run format
npm run lint
npm test
npm run build
npm run build:server
```

For visual or browser workflow changes, also run:

```bash
npm run visual
```

## Reporting Issues

Use the bug report or feature request templates. Include reproduction steps, expected behaviour, actual behaviour, browser/device details, and screenshots when they help.
Use a conventional issue title: `type(scope): summary`. Supported issue title types are `bug`, `feature`, `maintenance`, `docs`, `test`, `ci`, `security`, `deps`, and `question`.

## Issue Triage

Maintainers triage issues before work starts so the backlog stays executable:

- New or unclear issues use `status:needs-triage`.
- A triaged issue moves to `status:ready` once it has a clear type label, area label, milestone, and next action or acceptance criteria.
- Issue standards require at least one `type:*` label, one `area:*` label, and one `status:*` label.
- Assignees, linked projects, and priority labels are optional. A milestone is required only when an issue is marked `status:ready`.
- Use `priority:high` only for work that blocks the next milestone, fixes a high-risk defect, or protects security/release confidence.
- Milestones show execution order. Work through `01 - CI hardening`, `02 - Testing expansion`, `03 - Security hardening`, `04 - Multiplayer hardening`, `05 - Architecture cleanup`, then `06 - Repository/community health`, unless a maintainer calls out a sharper dependency.
- If an issue changes scope, move it back to `status:needs-triage` until the milestone, priority, and acceptance criteria are clear again.

## Contributor Credit

You may add yourself to [CONTRIBUTORS.md](CONTRIBUTORS.md) in your first accepted pull request.
