# Contributing

Thanks for helping improve Casino Warehouse.

Casino Warehouse accepts changes through pull requests only. The `main` branch is protected, direct commits are blocked, and pull requests are merged with squash commits.

Casino Warehouse is a public, source-available, noncommercial demo project. Public availability does not grant commercial use rights, and contributions are accepted under the existing [PolyForm Noncommercial License 1.0.0](LICENSE).

## Before You Start

- Read the [README](README.md) for local setup.
- Read the [license](LICENSE). Commercial use is not permitted.
- Read the [governance policy](GOVERNANCE.md) for maintainer decisions, issue triage, and pull request review expectations.
- Check existing issues and pull requests before opening duplicates.
- Keep changes focused. Separate unrelated fixes into separate pull requests.

## Contribution Scope

Contributions are welcome when they fit the demo's scope, especially documentation, tests, accessibility improvements, security fixes, bug fixes, gameplay polish, and repository tooling. Larger feature or policy changes should start as an issue so maintainers can confirm the direction before implementation.

The package is marked `"private": true` in `package.json` intentionally. Casino Warehouse is meant to be installed and run from the repository checkout, and the private package flag helps prevent accidental npm publication; it does not change the public repository status or the noncommercial license.

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

The `main` branch ruleset requires the CodeQL workflow status check `Analyze (javascript-typescript)` before protected refs can update. The native ruleset `code_scanning` rule for CodeQL is not enabled right now because, on May 12, 2026, GitHub generated a `CodeQL` check that stayed queued even after the CodeQL workflow completed successfully and code scanning analyses were uploaded. Keep the required workflow status check in place while that native ruleset behavior is unresolved, and re-enable the native code scanning gate only after a pull request proves that the generated `CodeQL` check completes reliably.

The required CI aggregate appears on pull requests as `Build, Test, and Visual Checks / Required Quality Gate`, and the repository ruleset uses the `Required Quality Gate` status context. Its prerequisite checks use descriptive names such as `Build, Test, and Visual Checks / Quality, Coverage, and Server Build` and `Build, Test, and Visual Checks / Playwright Visual and E2E (Laptop Visual)`.

GitHub Code Quality is not enabled for this repository, so the ruleset does not enforce a Code Quality gate. As of May 12, 2026, GitHub documents Code Quality as available for organization-owned repositories on GitHub Team or GitHub Enterprise Cloud plans; `LMLiam/Casino-Warehouse` is a public repository owned by the personal `LMLiam` user account. Repository Actions are enabled and the TypeScript codebase is a supported analysis target, but there is no dynamic `Code Quality` workflow, no `CodeQL - Code Quality / Analyze` pull request check, and no default-branch Code Quality analysis for this repository yet.

Maintainers must not enable the native Code Quality ruleset gate until the repository is eligible for GitHub Code Quality and a pull request has a passing `CodeQL - Code Quality / Analyze` check. Once the repository is organization-owned on an eligible plan, enable Code Quality from `Settings` > `Security` > `Code quality`, verify both a default-branch analysis and a pull request analysis, then update the `main protection with owner bypass` ruleset with a native Code Quality requirement using an `Errors` threshold first. Keep the existing required status checks in place unless maintainers intentionally change them. Contributors blocked by either gate should inspect the pull request checks and code scanning or Code Quality annotations, fix the reported finding, and push an updated commit.

Supply-chain controls are documented in [docs/supply-chain-security.md](docs/supply-chain-security.md). Workflow changes must keep external GitHub Actions pinned to full commit SHAs with same-line version comments, Dependabot updates enabled for GitHub Actions, and Dependency Review configured for moderate-or-higher vulnerabilities in runtime, development, and unknown scopes.

## Source File Shape

Keep new `src/` modules focused on one module-scope top-level element. Classes, React components, functions, constants, variables, interfaces, types, enums, and schemas all count as top-level elements whether or not they are exported. File-local implementation details must be nested inside the element they support or extracted into focused module files.

`npm run architecture:check` enforces this convention. Re-export-only files are not allowed; import the focused module file directly instead of adding a barrel. Pure type aggregation files and other mixed modules are not grandfathered; split each declaration into a focused module instead. Avoid vague split targets such as `utils.ts` or `helpers.ts`; use names that describe the domain concept being extracted.

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

Playwright defaults to two workers so browser tests catch shared-state
collisions quickly without overloading local laptops. The
`Build, Test, and Visual Checks` workflow runs the same
`npm run visual` script through a coverage matrix to shorten the e2e
wall-clock time while keeping visual regression and browser workflow coverage
on laptop and tablet, plus multiplayer coverage in the required aggregate
`Required Quality Gate` check. The pull request checks page labels those lanes as
`Playwright Visual and E2E (Laptop Visual)`,
`Playwright Visual and E2E (Tablet Visual)`, and
`Playwright Visual and E2E (Laptop Multiplayer)`. To reproduce a CI lane
locally, use one of:

```bash
npm run visual -- --project=laptop tests/e2e/casino-visual.spec.ts
npm run visual -- --project=tablet tests/e2e/casino-visual.spec.ts
npm run visual -- --project=laptop tests/e2e/multiplayer-flow.spec.ts tests/e2e/ngrok-smoke.spec.ts
```

Serial execution is reserved for debugging with `npm run visual:serial`.
The committed e2e config does not force any spec file into serial mode;
the multi-context specs in `tests/e2e/multiplayer-flow.spec.ts` and
`tests/e2e/ngrok-smoke.spec.ts` skip tablet project duplication inside the
test files. For debugging a flaky browser test serially, use:

```bash
npm run visual:serial
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
