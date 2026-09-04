# Governance

Casino Warehouse is a public, source-available, noncommercial demo project. This policy explains how maintainers guide project direction, triage issues, and review pull requests.

## Maintainers And Decisions

Casino Warehouse is maintained by the repository owner and any collaborators with maintainer access. Maintainers are responsible for repository settings, issue triage, pull request review, release direction, and final merge decisions.

Decisions are made in the open when practical, using issues and pull requests as the working record. Maintainers prioritize changes that keep the demo reliable, noncommercial, secure, accessible, and maintainable. Larger feature, policy, or architecture changes should start as an issue before implementation so maintainers can confirm the direction and scope.

Maintainers may decline or defer work that is out of scope, commercially oriented, too broad for the current roadmap, insufficiently specified, duplicative, unsafe, or inconsistent with the license and project goals. When that happens, maintainers should leave a short explanation and use the appropriate issue state or labels.

## Issue Triage

Issues should use the bug report or feature request templates when they apply. Maintainers triage issues before work starts so the backlog stays executable:

- New or unclear issues use `status:needs-triage`.
- Ready issues use `status:ready` once they have a clear type label, area label, milestone, and next action or acceptance criteria.
- Blocked issues use `status:blocked` when another issue, maintainer decision, external service, or repository setting must be resolved first.
- `priority:high` is reserved for work that blocks the next milestone, fixes a high-risk defect, or protects security or release confidence.
- Maintainers may close issues that are duplicates, completed, stale after follow-up, not planned, outside the noncommercial demo scope, or no longer accurate after newer work.

Maintainers use the live GitHub milestones, issues, and project views to
communicate delivery order. Do not copy the current backlog or milestone order
into this file. Maintainers may reorder work when a dependency, security
concern, or contributor availability makes a different path safer.

## Pull Request Review

Pull requests must follow the template, use a conventional title, include the required labels, and keep generated build output out of commits. Maintainers review pull requests after the relevant local checks and required GitHub checks pass.

Commit messages and pull request titles use `type(scope): summary`. Supported types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `security`, and `deps`. Use lower-case letters, numbers, and hyphens in the scope. Keep the summary at least five characters long.

Maintainer review focuses on correctness, security, maintainability, accessibility, test coverage, fit with the current milestone, and consistency with the noncommercial/source-available project scope. Pull requests may be held, requested for changes, or closed when they do not meet those expectations.

The `main` branch is protected. Direct commits are blocked, required checks must pass, and maintainers merge accepted pull requests with squash commits. Maintainers may edit the squash title or body to match repository history.

Review is best effort. There is no guaranteed response time, but a polite follow-up is reasonable if a ready pull request has not received maintainer attention after about two weeks.

## Contribution Scope

External contributions are welcome when they fit the demo's scope, especially documentation, tests, accessibility improvements, security fixes, bug fixes, gameplay polish, and repository tooling.

Public availability does not grant commercial use rights. Contributions are accepted under the existing [PolyForm Noncommercial License 1.0.0](LICENSE), and contributors should avoid changes that imply gambling, cash-out flows, payments, crypto, NFTs, or other commercial casino use.
