# AGENTS.md

This file is guidance for coding agents working in Casino Warehouse. It complements, but does not replace, `README.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `docs/code-quality.md`, and `docs/supply-chain-security.md`.

Explicit user instructions take precedence over this file. If a future nested `AGENTS.md` exists, treat it as applying to its subtree and combine it with this root guidance.

## Project Overview

Casino Warehouse is a source-available, noncommercial, fictional-money casino arcade for desktop and tablet browsers. It includes Beat the House, Blackjack, slots rooms, local multiplayer, a small Node realtime server, browser storage, and optional SQLite-backed server data.

Credits have no cash value. Do not introduce deposits, withdrawals, payments, crypto, NFTs, cash-out flows, or commercial casino positioning.

Primary references:

- `README.md`: setup, runtime, ngrok demo flow, local data, license, and project status.
- `CONTRIBUTING.md`: PR rules, issue triage, local checks, and security/quality gates.
- `GOVERNANCE.md`: maintainer decisions, milestone order, issue triage, and review expectations.
- `docs/code-quality.md`: domain boundaries, architecture rules, and source file shape.
- `docs/supply-chain-security.md`: workflow action pinning, Dependency Review, Scorecard, and SBOM notes.

## Environment

- Use Node.js 22.x. The supported range is `>=22.12.0 <23`; read `.nvmrc` or `.node-version` when using a version manager.
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
- `npm run format`: check editorconfig and Prettier formatting.
- `npm run lint`: run ESLint, typecheck, architecture checks, and supply-chain checks.
- `npm run test`: run the Vitest suite.
- `npm run test:coverage`: run Vitest with coverage thresholds.
- `npm run visual`: build and run Playwright browser tests.
- `npm run visual:serial`: run Playwright with one worker for debugging shared-state issues.
- `npm run check`: run lint, format, coverage, server build, and visual tests.

Run the narrowest meaningful checks while iterating, then run the broader checks that cover the changed surface before opening or updating a pull request. For UI, browser workflow, multiplayer, or visual changes, include Playwright coverage with `npm run visual` or `npm run visual:serial`. CI displays those lanes as `Playwright Visual and E2E (Laptop Visual)`, `Playwright Visual and E2E (Tablet Visual)`, and `Playwright Visual and E2E (Laptop Multiplayer)` while preserving the protected aggregate `test` check; reproduce one lane locally with `npm run visual -- --project=laptop tests/e2e/casino-visual.spec.ts`.

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
- Maintain the required CodeQL workflow status check and other required checks. The CI aggregate status currently remains `CI / test` so branch protection can keep a stable required check while the supporting jobs use descriptive display names. The native CodeQL `code_scanning` ruleset rule is currently disabled because GitHub left its generated `CodeQL` check queued after successful analyses; re-enable it only after a pull request proves that check completes reliably. GitHub Code Quality is documented as externally blocked for this personal-account repository until eligibility changes.

## Issue Completion Workflow

When asked to complete, finish, fix, review, ready, update, or check an issue or pull request, use the Casino Warehouse issue-completion skill at `.agents/skills/casino-issue-completion/SKILL.md`.

Do not describe an issue or pull request as complete, ready, ready to merge, done, or finished unless the skill's evidence checklist is satisfied on the current PR head.

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

If repository permissions prevent leaving PR review comments, the agent must still produce review findings in the final response using file paths and line-level references where possible. It must not silently skip the review-comment step.

After any new commit, rebase, merge from the target branch, force-push, PR body edit that reruns checks, or resolved-comment action, the pull request must be reviewed again before being called ready.

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

## Documentation Guidance

- Keep agent-facing instructions in this file concise and operational.
- Link to existing docs instead of duplicating long policy text.
- Update this file when repository commands, checks, workflow gates, or agent expectations change.
