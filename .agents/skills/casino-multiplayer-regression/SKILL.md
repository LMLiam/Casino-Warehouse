---
name: casino-multiplayer-regression
description: Review Casino Warehouse multiplayer regressions across pull requests, branches, issues, subsystems, or named files with evidence-backed risk and targeted checks.
---

# Casino Multiplayer Regression Review

Use this skill when a user asks for a multiplayer regression pass, realtime
flow review, public tunnel smoke assessment, room authority review,
reconnect/reload check, or focused review of Casino Warehouse multiplayer
behavior.

This skill finds multiplayer regressions and maps risk to evidence. It does
not replace `.agents/skills/casino-pr-full-review/SKILL.md` for full pull
request review, and it does not replace
`.agents/skills/casino-issue-completion/SKILL.md` when the user asks whether a
pull request or issue is complete, ready, fixed, updated, or mergeable.

## Scope Rules

- Keep Casino Warehouse in its fictional-money, noncommercial demo scope. Do
  not recommend deposits, withdrawals, payments, crypto, NFTs, cash-out flows,
  commercial casino positioning, or production gambling operations.
- Treat public tunnel sessions as trusted demos, not production hosting.
- Review server authority as the source of truth for room lifecycle, seat
  ownership, profile ownership, bankroll mutation, settlement, admin
  capability, and persistence reconciliation.
- Do not accept client UI behavior as proof that a multiplayer rule is safe.
  Inspect the protocol schema, server authority, persistence boundary, and
  related tests when they apply to the target.
- Do not recommend weakening WebSocket origin checks, profile-token controls,
  admin-token controls, branch protection, CodeQL, Dependency Review, action
  pinning, or public-tunnel trust checks.
- Web-verify before making current claims about vulnerabilities, advisories,
  CVEs, deprecations, latest versions, supported versions, feature
  availability, or current best practices. If no review claim depends on
  current external facts, state that no current-info verification was needed.

## Review Targets

The target can be a pull request, branch diff, issue, subsystem, directory, or
named file list.

Before reviewing, identify and record:

- target type and target name or number
- base branch and base commit when reviewing a diff
- head branch and head commit when reviewing a diff
- changed files, directories, or subsystem reviewed
- related protocol, server authority, client URL, persistence, and test files
  inspected
- local working tree status if a checkout is used

For pull requests, fetch PR metadata, changed files, prior multiplayer-related
comments, and current check status before relying on local evidence. For branch
or local reviews, inspect the relevant diff and related code.

## Required Repository Context

Read the relevant parts of:

- `AGENTS.md`
- `README.md`
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `docs/code-quality.md`
- `docs/supply-chain-security.md`
- `.github/PULL_REQUEST_TEMPLATE.md` when reviewing a pull request
- `.agents/skills/casino-issue-completion/SKILL.md` when readiness is in scope

Inspect related source, schemas, tests, scripts, and docs for the selected
target. Reviewing only the changed lines is not enough when realtime behavior
depends on room authority, persisted state, browser-local profile credentials,
or public tunnel runtime configuration.

## Multiplayer Risk Checklist

Review the items that are relevant to the target:

- Room lifecycle: create, list, start, close, expire, recover, and cleanup flows
  preserve server authority and do not strand sessions.
- Host and join flows: host identity, invite handling, duplicate joins, stale
  rooms, and profile ownership checks remain enforced.
- Seat claims: seat ownership, reseating, local/remote collision handling, and
  turn ownership cannot be spoofed from public `profileId` values.
- Spectators: spectator joins, snapshots, and promotions do not gain player or
  host authority unless the server explicitly grants it.
- Reconnect and reload behavior: browser reloads, tab duplication, connection
  replacement, and stale socket cleanup reconcile to one authoritative session.
- Heartbeats: ping, pong, timeout, stale-connection cleanup, and reconnect
  timing avoid false eviction and zombie room membership.
- WebSocket origin checks: local development origins and configured public base
  URLs are trusted, while unexpected public origins remain rejected.
- Public invite URLs: localtunnel, ngrok, Cloudflare quick tunnels, and custom
  `PUBLIC_BASE_URL` or `PUBLIC_WEBSOCKET_URL` values generate display-safe
  invites without bypassing origin policy.
- Profile ownership: browser-local profile credentials are required for rename,
  delete, save, host, and join operations; public profile IDs alone are never
  treated as authority.
- Admin permissions: destructive admin actions require `CASINO_ADMIN_TOKEN`,
  admin capability is not logged or broadcast, and admin-only snapshots stay
  private.
- Room snapshots: public snapshots, room lists, `data-state`, and realtime
  messages exclude profile tokens, admin capability, and other credentials.
- Settlements: multiplayer payout, bankroll, ledger, and game-state settlement
  remain server-owned and are not recomputed in UI renderers.
- Persistence reconciliation: persisted profiles, bankrolls, ledgers, rooms,
  and reconnect state are schema-validated and reconcile safely after restart
  or storage corruption.

## Surface-To-Check Map

Map changed surfaces to targeted checks:

- `src/multiplayer/`: inspect protocol handling, `roomAuthority`, server entry,
  client connection behavior, and run focused multiplayer unit tests.
- `src/state/` or `src/schemas/`: inspect persisted envelopes and validation,
  then run state and multiplayer unit tests that cover reconciliation and
  malformed data.
- `src/app/`, `src/ui/`, or realtime URL helpers: inspect client URL selection,
  visible state, invite rendering, profile credential use, and UI boundaries;
  include Playwright coverage when visible multiplayer behavior changes.
- Public tunnel scripts: inspect `scripts/dev-public.mjs`,
  `scripts/dev-localtunnel.mjs`, `scripts/dev-cloudflare.mjs`, server origin
  policy, and public tunnel smoke guidance.
- Tests or fixtures: verify deterministic RNG, deck, reel, profile, room, and
  server fixtures are used where game/state outcomes are asserted.
- Workflow, agent, or docs changes: validate shell syntax, formatting, and the
  generated `/goal` text; explain why runtime multiplayer tests are not needed
  when no runtime behavior changed.

Use the smallest command that gives meaningful evidence, then broaden only when
the risk surface requires it.

## Useful Commands

Adapt these commands to the target:

```bash
git status --short --branch
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
npm run test -- tests/unit/multiplayer
npm run test -- tests/unit/state
npm run visual -- --project=laptop tests/e2e/multiplayer-flow.spec.ts tests/e2e/public-tunnel-smoke.spec.ts
PUBLIC_TUNNEL_SMOKE_URL=https://example.trycloudflare.com npm run visual -- --project=laptop tests/e2e/public-tunnel-smoke.spec.ts
bash -n start-codex-multiplayer-check.sh
npm run format
npm run lint
```

Run the live public tunnel smoke test only when a trusted tunnel URL is
available. If it cannot be run, record that fact and give the exact command and
environment variable needed to run it later.

## Workflow

1. Confirm the target and whether the user wants review only or also wants
   fixes.
2. Read the required repository context for the target.
3. Fetch current PR, issue, branch, and check evidence when the target is on
   GitHub.
4. Inspect the target diff or files and the related multiplayer authority,
   protocol, persistence, URL, and tests.
5. Build a risk matrix from the changed surfaces to the multiplayer checklist
   above.
6. Select targeted checks from the surface-to-check map and run the narrowest
   useful commands, or record why a check is skipped.
7. Web-verify any current external security, version, advisory, CVE,
   deprecation, or best-practice claim.
8. Produce evidence-backed findings with concrete reproduction or test
   evidence.
9. If the user asked for fixes, implement only evidence-backed changes, preserve
   existing authority and token controls, and rerun relevant checks.

## Finding Format

Report each finding in severity order using this shape:

- Location: file path and line number where possible
- Severity: `critical`, `high`, `medium`, `low`, or `info`
- Category: `bug`, `security`, `test`, `documentation`, `architecture`,
  `maintainability`, or `performance`
- Failure mode: how the multiplayer regression can be triggered or why it
  matters
- Evidence: code, test, CI, log, command, screenshot, or current-info source
  that supports the finding
- Suggested fix: concrete remediation that preserves server authority and
  existing security controls
- Blocking: `yes` or `no`

Confirmed regressions need direct evidence of behavior that can fail or violate
project policy. Hardening suggestions should explain why they are
defense-in-depth rather than proof of a current defect. Residual risks should
name what remains after existing controls and tests.

## Final Report

Use this report shape:

```txt
Target:
Scope reviewed:
Changed files or subsystem reviewed:
Commands run:
Current-info verification:
Multiplayer risks checked:
Findings:
Targeted checks:
Public tunnel smoke:
Residual risks:
Unresolved assumptions:
Status:
```

`Status` must be one of:

- `No multiplayer regressions found`
- `Findings need fixes`
- `Fixes implemented; verification passing`
- `Blocked`
