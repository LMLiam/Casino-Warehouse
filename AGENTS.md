# AGENTS.md

This file is guidance for coding agents working in Casino Warehouse. It complements, but does not replace, `README.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `docs/code-quality.md`, and `docs/supply-chain-security.md`.

Explicit user instructions take precedence over this file. If a future nested `AGENTS.md` exists, treat it as applying to its subtree and combine it with this root guidance.

## Project Overview

Casino Warehouse is a source-available, noncommercial, fictional-money casino arcade for desktop and tablet browsers. It includes Beat the House, Blackjack, slots rooms, local multiplayer, a small Node realtime server, browser storage, and optional SQLite-backed server data.

Credits have no cash value. Do not introduce deposits, withdrawals, payments, crypto, NFTs, cash-out flows, or commercial casino positioning.

Primary references:

- `README.md`: setup, runtime, public tunnel demo flows, local data, license, and project status.
- `CONTRIBUTING.md`: PR rules, issue triage, local checks, and security/quality gates.
- `GOVERNANCE.md`: maintainer decisions, milestone order, issue triage, and review expectations.
- `docs/code-quality.md`: domain boundaries, architecture rules, and source file shape.
- `docs/supply-chain-security.md`: workflow action pinning, Dependency Review, Scorecard, and SBOM notes.

## Environment

- Use Node.js 26.x. The supported range is `>=26.0.0 <27`; read `.nvmrc` or `.node-version` when using a version manager.
- Use npm, not another package manager.
- Install dependencies with `npm install` for local development. CI uses `npm ci`.
- Phone-sized screens are intentionally unsupported.

## Useful Commands

- `npm run dev`: start the Vite client shell only.
- `npm run build`: typecheck and build the browser app.
- `npm run build:server`: build the realtime server bundle.
- `npm run dev:server`: build the server and serve the built app at `http://127.0.0.1:8787` by default.
- `npm run dev:full`: build the app and server, then start the realtime server.
- `npm run dev:public`: run the ngrok-backed public demo flow.
- `npm run dev:ngrok`: run the provider-specific ngrok public demo flow.
- `npm run dev:localtunnel`: run the provider-specific localtunnel public demo flow.
- `npm run dev:cloudflare`: run the provider-specific Cloudflare Tunnel quick-tunnel public demo flow.
- `npm run dev:cloudflared`: alias for `npm run dev:cloudflare`.
- `npm run format`: check editorconfig and Prettier formatting.
- `npm run lint`: run ESLint, typecheck, architecture checks, and supply-chain checks.
- `npm run test`: run the Vitest suite.
- `npm run test:coverage`: run Vitest with coverage thresholds.
- `npm run visual`: build and run Playwright browser tests.
- `npm run visual:serial`: run Playwright with one worker for debugging shared-state issues.
- `npm run check`: run lint, format, coverage, server build, and visual tests.

Run the narrowest meaningful checks while iterating, then run the broader checks that cover the changed surface before opening or updating a pull request. For UI, browser workflow, multiplayer, or visual changes, include Playwright coverage with `npm run visual` or `npm run visual:serial`. The `Project Checks` workflow displays those lanes as `Visual and E2E (Laptop Visual)`, `Visual and E2E (Tablet Visual)`, and `Visual and E2E (Laptop Multiplayer)` with the aggregate `Required Quality Gate` check; reproduce one lane locally with `npm run visual -- --project=laptop tests/e2e/casino-visual.spec.ts`.

## Repository Rules

- Work through issues and pull requests. Do not commit directly to `main`.
- Keep changes focused on the issue or user request.
- Prioritize the complete, correct resolution for the requested issue over the smallest possible diff. Security, multiplayer, workflow, and policy issues often need coordinated code, tests, and documentation updates to be correct.
- Use branches or worktrees so unrelated user work is not disturbed. If the user asks for a worktree, create a separate worktree for the branch.
- Name agent-created branches by issue or purpose, for example `issue-71-agents-md`. Do not prefix branch names with `codex/` or other tool-ownership markers.
- Preserve generated build output out of commits.
- Follow conventional PR titles: `type(scope): summary`.
- PRs need at least one `type:*` label and one `area:*` label.
- Issues use `type(scope): summary` titles and need `type:*`, `area:*`, and `status:*` labels.
- Ready issues need a milestone and clear next action or acceptance criteria.
- Do not weaken CodeQL, Dependency Review, branch protection, action pinning, or other security controls.
- External GitHub Actions must stay pinned to full 40-character commit SHAs with same-line version comments.

## Code Organization

Use the narrowest domain owner for new modules:

- `src/game/`: pure game engines, card/RNG primitives, payout and settlement rules, slot themes, and catalog data.
- `src/multiplayer/`: realtime protocol, server entrypoint, room authority, heartbeat handling, and room/session coordination.
- `src/state/`: server data persistence, persisted profile/session schemas, and flow state machines.
- `src/schemas/`: Zod schemas for runtime boundaries and persisted envelopes.
- `src/assets/`: asset manifest and asset path helpers.
- `src/audio/`: audio settings and playback service.
- `src/ui/`: rendering primitives, Pixi table, Radix chrome, layout data, and visual-only helpers.
- `src/app/shell/`: browser application coordinator and DOM event binder.
- `src/app/dom/`: shell template and typed element collection.
- `src/app/views/`: DOM view renderers and view-local controllers.
- `src/app/state/`: app snapshots and player construction for rendering server-owned data.
- `src/app/input/`: DOM input parsing and table hit testing.
- `src/app/format/`: display-only formatting and HTML list rendering.
- `src/app/rooms/`: room defaults and room-specific app constants.
- `tests/unit/<domain>/`: Vitest coverage grouped by source domain.
- `tests/e2e/`: Playwright browser workflows.

Keep authoritative game, payout, bankroll, persistence, and realtime rules out of UI renderers. UI can display returned values and labels, but it must not recompute payouts, bankroll changes, or settlement outcomes.

## Source File Shape

- Keep new source modules focused on one module-scope top-level element.
- Classes, React components, functions, constants, variables, interfaces, types, enums, and schemas all count as top-level elements whether or not they are exported.
- File-local implementation details must be nested inside the element they support or extracted into focused module files.
- Avoid vague filenames such as `utils`, `helpers`, `misc`, and `manager`.
- Do not add barrel files; import focused module files directly.
- Hard ban: never use the TypeScript `unknown` or `object` types, `z.unknown()`, `as unknown`, or a chained assertion through `unknown` anywhere in source or tests. Use a named domain type, runtime type guard, schema, or type-safe construction instead.
- Name non-neutral numeric values with the narrowest domain constant, class-private constant, config object, or test fixture. Use same-line `casino-magic-number-allow: <reason>` comments only for intentional inline exceptions.
- Respect the architecture checker instead of bypassing it.

## Testing Guidance

- Add or update tests for behavior changes.
- Use deterministic RNG, deck, reel, profile, and server fixtures when asserting game or multiplayer behavior.
- Use unit tests for pure game/state/tooling logic.
- Use server/client tests for realtime protocol, persistence, authorization, reconnection, and room lifecycle behavior.
- Use Playwright for browser workflows, accessibility-visible behavior, visual regressions, and cross-browser/context multiplayer flows.
- If a test is not needed for a docs-only or metadata-only change, say so clearly in the PR.

## Security And Multiplayer Guidance

- Public tunnel sessions are trusted demos, not production hosting.
- Server-created profiles use browser-local profile credentials. Do not treat a public `profileId` as permission to mutate or join as that profile.
- Destructive admin actions require `CASINO_ADMIN_TOKEN`; do not leak admin tokens in docs, logs, or URLs.
- Keep profile tokens and admin capability out of public `data-state`, room snapshots, room lists, and other broadcast messages.
- Maintain the required CodeQL workflow status check and other required checks. Required pull request contexts are `Required Quality Gate`, `Analyze (javascript-typescript)`, `Validate Pull Request Metadata`, and `Review Dependency Changes`; GitHub displays the aggregate CI gate as `Project Checks / Required Quality Gate`. The native CodeQL `code_scanning` ruleset rule is currently disabled because GitHub left its generated `CodeQL` check queued after successful analyses; re-enable it only after a pull request proves that check completes reliably. GitHub Code Quality is documented as externally blocked for this personal-account repository until eligibility changes.

## Issue Completion Workflow

When asked to complete, finish, fix, review, ready, update, or check an issue or pull request, follow the evidence requirements below.

Do not describe an issue or pull request as complete, ready, ready to merge, done, or finished unless the evidence checklist below is satisfied on the current PR head.

A self-review claim is invalid unless it includes evidence. The agent must name:

- the target branch and target branch commit reviewed against
- the current branch and HEAD commit
- the changed files inspected
- the commands run
- the correctness, security, performance, architecture, maintainability, test, and documentation risks checked
- any web/current-info verification used for version, deprecation, CVE, security-advisory, best-practice, or feature-availability claims
- the PR review comments left, or the exact reason comments could not be left
- the fixes made after review, if any
- the CI/check status for the latest pushed commit

Saying only "I performed a self-review and found no issues" is non-compliant.

After a pull request exists, every self-review finding must be recorded as a pull request review comment before it is fixed. Do not edit, commit, or push a fix for a self-review finding until the pull request review comment exists and the comment URL or ID is recorded, unless comment creation failed and the exact attempted tool or command plus exact failure has already been recorded. Final readiness evidence must list every self-review finding with its PR comment URL or ID, fix commit SHA if fixed, and resolution reply URL or ID when available.

If repository permissions prevent leaving PR review comments, the agent must still produce review findings in the final response using file paths and line-level references where possible. It must not silently skip the review-comment step.

After any new commit, rebase, merge from the target branch, force-push, PR body edit that reruns checks, or resolved-comment action, the pull request must be reviewed again before being called ready.

## Issue Creation Workflow

When asked to create, open, draft, file, or prepare a new GitHub issue from a user request: inspect relevant repository context, search existing open and closed issues and pull requests for duplicates or related work, choose repository-compliant title/labels/status/milestone, create the issue through GitHub, then verify the created issue number, URL, metadata, and body before reporting success.

## Issue Triage Workflow

When asked to triage, groom, clarify, label, milestone, de-duplicate, decline, block, or ready an existing GitHub issue without implementing it: inspect the issue, search existing issues and pull requests for duplicates or related work, read relevant repository context, update labels/milestone/body/comments only when evidence supports the change, then verify and report the issue URL, labels/milestone before and after, duplicate-search terms, files inspected, and unresolved questions.

## Issue Dependency Audit Workflow

When asked to audit, map, review, clarify, update, or report dependency relationships between existing GitHub issues: review every open issue, group the backlog by milestone, label, and status, inspect issue bodies, comments, linked pull requests, and reverse references, distinguish evidence-backed blockers from preferred sequencing, update issue labels or canonical dependency notes only when evidence supports the change, avoid closing or re-scoping issues unless a maintainer explicitly asks, verify any updates, and report blocker relationships in both directions plus maintainer-clarification needs.

## CI Failure Review Workflow

When asked to inspect, explain, diagnose, review, retry, or fix failing pull request checks: fetch current pull request metadata, head SHA, base branch, required check status, workflow runs, failing jobs, and relevant logs before diagnosing a failure. Distinguish required checks from informational or external checks, map visual/e2e failures to local reproduction commands where applicable, classify the failure cause, and ask before making fixes unless the user's active goal clearly asks to fix CI.

## Documentation Audit Workflow

When asked to audit, verify, or report documentation drift without immediately implementing fixes: compare docs, wiki pages, workflow references, npm scripts, issue and pull request templates, launcher scripts, and local agent skills against source-of-truth files, commands, GitHub metadata, and wiki evidence. Report findings with location, evidence, severity, suggested remediation, skipped checks, and whether each finding is docs-only drift or implementation work.

## Security Review Workflow

When asked for a security pass, threat-model-style review, token or authorization audit, public tunnel audit, dependency security review, workflow security review, or other focused security assessment: inspect the requested target and related tests and controls before recommending changes, distinguish confirmed vulnerabilities from hardening suggestions and residual risks, verify current-info claims for advisories, CVEs, deprecations, versions, or best practices, and must not weaken CodeQL, Dependency Review, action pinning, branch protection, public-tunnel origin protections, admin-token controls, profile-token controls, or server authority.

## Multiplayer Regression Workflow

When asked for a multiplayer regression pass, realtime flow review, public tunnel smoke assessment, room authority review, reconnect/reload check, or focused review of multiplayer behavior: inspect changed files and related protocol schemas, server authority, client realtime URL behavior, persistence boundaries, public tunnel scripts, and relevant tests when applicable. Map room lifecycle, host/join, seat claim, spectator, reconnect, heartbeat, WebSocket origin, public invite URL, profile ownership, admin permission, room snapshot, settlement, and persistence reconciliation risks to targeted checks, including unit tests and Playwright multiplayer or public tunnel smoke lanes where relevant.

## Architecture Cleanup Workflow

When asked to split large files, fix source-file shape problems, reduce architecture-check failures, move modules between domain owners, or plan structural cleanup: inspect `docs/code-quality.md`, target files, imports, dependents, relevant tests, and architecture-check rules before proposing a split. Preserve behavior, direct imports, one module-scope top-level element per source file, domain ownership, circular-dependency safety, and game/multiplayer/state authority boundaries.

## Pull Request Checklist

Before opening or updating a PR:

- Read `CONTRIBUTING.md`.
- Fill in every section of `.github/PULL_REQUEST_TEMPLATE.md`.
- Select one PR type checkbox.
- Check every required checkbox in the PR template.
- Include a non-empty `Commands run` block in the Testing section.
- Add the right `type:*` and `area:*` labels.
- Link the issue being completed when applicable.
- Run the relevant local checks and record the exact commands.
- Confirm the pull request branch is up to date with the latest target branch, normally `main`, before marking the work complete.
- Confirm the issue completion review loop has been run on the current PR head, including after any rebase or follow-up fix.
- Confirm generated build output is not committed.

## Local Agent Skills

The repo-owned local skills previously hosted under `.agents/skills/` (and the `start-codex.sh` launcher) have been removed pending a redesign. Do not recreate them or reference them until the replacement setup lands; if older issues, pull requests, or docs point at those paths, treat the references as stale.

## Documentation Guidance

- Keep agent-facing instructions in this file concise and operational.
- Link to existing docs instead of duplicating long policy text.
- Update this file when repository commands, checks, workflow gates, or agent expectations change.
