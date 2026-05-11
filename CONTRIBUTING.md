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
