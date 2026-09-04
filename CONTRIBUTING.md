# Contributing

Casino Warehouse accepts changes through pull requests. Read the [README](README.md)
for setup, the [licence](LICENSE) before contributing, and
[GOVERNANCE.md](GOVERNANCE.md) for maintainer decisions and issue triage.

Casino Warehouse is a source-available, noncommercial demo project. Public
availability does not grant commercial use rights. Contributions are accepted
under the existing [PolyForm Noncommercial License 1.0.0](LICENSE).

## Contribution Scope

Contributions are welcome when they fit the demo's scope, especially:

- documentation;
- tests;
- accessibility improvements;
- security fixes;
- bug fixes;
- gameplay polish; and
- repository tooling.

Start larger feature, policy, or architecture changes as an issue. This lets
maintainers confirm the direction and scope before implementation.

## Pull Requests

- Open a pull request from a branch or fork. Do not commit directly to `main`.
- Use `.github/PULL_REQUEST_TEMPLATE.md` and complete every section.
- Use a conventional title such as `docs(scope): summary`. Supported types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `security`, and `deps`.
- Add at least one `type:*` label and one `area:*` label.
- Include tests or explain why tests are not needed.
- Keep generated build output out of commits.
- Keep the change focused and separate unrelated fixes.
- Wait for the required checks and maintainer review.

The package is marked `"private": true` to prevent accidental npm publication.
This does not change the public repository status or the noncommercial licence.

## Security And Quality Gates

Pull requests to protected `main` must pass the repository's quality, CodeQL
analysis, pull request metadata, and dependency-review workflows. The CI
aggregate includes formatting, static lint and type checking, architecture and
unused-code checks, supply-chain checks, unit coverage, the server build, and
the Playwright matrix.

The CodeQL workflow status is the repository's CodeQL gate. The native
`code_scanning` ruleset check is not a separate required gate. Do not change
that policy without maintainer review and a passing pull request that proves
the replacement check completes reliably.

GitHub Code Quality is not a configured repository check. Do not add it as a
required gate without a maintainer decision and successful default-branch and
pull request verification.

See [supply-chain security](docs/supply-chain-security.md) for action pinning,
Dependabot, Dependency Review, CodeQL, Scorecard, and software bill of
materials (SBOM) guidance.

## Source Boundaries

Use the narrowest domain owner. Keep game rules, settlements, bankroll changes,
persistence, and realtime authority out of UI renderers. The browser displays
server-returned values and does not recalculate payouts or settlement results.

See [code quality](docs/code-quality.md) for source layout, strict schemas,
runtime boundaries, module shape, numeric rules, and import restrictions. See
[architecture](docs/architecture.md) for ownership and data flow.

## Local Checks

Use Node.js `>=26.0.0 <27` and npm. Configure your editor to respect
`.editorconfig`.

Run the relevant checks before requesting review:

```bash
npm install
npm run format
npm run lint
npm test
npm run build
npm run build:server
```

For browser, visual, multiplayer, or UI changes, read
[testing](docs/testing.md) and run the relevant Playwright project. The short
forms are:

```bash
npm run visual
npm run visual:serial
```

For a docs-only or metadata-only change, explain in the pull request why
behaviour tests are not needed. Always run formatting checks for maintained
Markdown.

## Issues

Use the bug report or feature request template when it applies. Check existing
issues and pull requests before opening a duplicate. Use a title such as
`bug(scope): summary`; supported issue types are `bug`, `feature`,
`maintenance`, `docs`, `test`, `ci`, `security`, `deps`, and `question`.

Maintainers use these labels and states:

- New or unclear issues use `status:needs-triage`.
- Ready issues use `status:ready` after they have a type label, area label, milestone, and clear next action or acceptance criteria.
- Blocked issues use `status:blocked` when another issue, decision, service, or setting must be resolved first.
- Issues need at least one `type:*`, one `area:*`, and one `status:*` label.
- Use `priority:high` only for milestone blockers, high-risk defects, or security and release risks.

## Contributor Credit

You may add yourself to [CONTRIBUTORS.md](CONTRIBUTORS.md) in your first
accepted pull request.
