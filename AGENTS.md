# Working In Casino Warehouse

Casino Warehouse is a source-available, noncommercial, fictional-money casino
arcade for desktop and tablet browsers. It includes Beat the House, Blackjack,
slots rooms, local multiplayer, browser storage, and a small Node.js realtime
server with optional SQLite data.

Credits have no cash value. Do not add deposits, withdrawals, payments,
cryptocurrency, non-fungible tokens, cash-out flows, or commercial casino
positioning.

Explicit user instructions override this file. A nested `AGENTS.md` applies to
its subtree and supplements this root guidance.

## Read First

- `README.md`: setup, runtime, local data, public demos, status, and licence.
- `CONTRIBUTING.md`: pull requests, local checks, issue standards, and quality gates.
- `GOVERNANCE.md`: maintainer decisions, milestones, triage, and review expectations.
- `docs/README.md`: maintained technical documentation.
- `docs/architecture.md`: current system structure and authority boundaries.
- `docs/code-quality.md`: source layout, type rules, schemas, and static checks.
- `docs/testing.md`: unit, browser, visual, coverage, and CI testing.
- `docs/public-tunnels.md`: temporary public multiplayer demos.
- `docs/beat-the-house-rules.md`: current six-deck Beat the House rules.
- `docs/supply-chain-security.md`: workflow and dependency controls.

## Environment And Commands

- Use Node.js `>=26.0.0 <27` and npm. Read `.nvmrc` or `.node-version` when using a version manager.
- Install local dependencies with `npm install`. CI uses `npm ci`.
- `npm run dev` starts the Vite client shell only.
- `npm run build` type-checks and builds the browser app.
- `npm run build:server` builds the realtime server bundle.
- `npm run dev:server` builds the server and serves the app at `http://127.0.0.1:8787` by default.
- `npm run dev:full` builds the app and server, then starts the server.
- `npm run dev:ngrok`, `npm run dev:localtunnel`, and `npm run dev:cloudflare` start public demo flows.
- `npm run format` checks EditorConfig and Prettier.
- `npm run lint` runs static, architecture, unused-code, and supply-chain checks.
- `npm test` runs Vitest. `npm run test:coverage` runs its coverage gate.
- `npm run visual` runs Playwright. `npm run visual:serial` uses one worker.
- `npm run check` runs lint, format, coverage, the server build, and Playwright.

Phone-sized screens are intentionally unsupported. Keep generated build output
out of commits.

## Source Map

- `src/game/`: pure game rules, cards, RNG, payouts, settlements, slots, and catalog data.
- `src/multiplayer/`: protocol, WebSocket lifecycle, room authority, game models, and heartbeat handling.
- `src/state/`: profiles, bankroll transactions, persistence, sessions, and room-flow machines.
- `src/schemas/`: strict Zod schemas for JSON, protocol, persisted state, and identifiers.
- `src/assets/`: asset manifest and focused asset accessors.
- `src/audio/`: audio settings and playback.
- `src/ui/`: Pixi rendering, layout, visual effects, React/Radix chrome, and display helpers.
- `src/app/`: browser shell, DOM views, display state, input, formatting, and room defaults.
- `tests/unit/<domain>/`: Vitest tests grouped by source domain.
- `tests/e2e/`: Playwright workflows and visual regression tests.

Use the narrowest domain owner. Do not add a generic `utils`, `helpers`,
`misc`, or `manager` module. Do not add barrel files. Keep one primary
module-scope element in each source file and keep source files below the
architecture check's 400-line limit.

## Authority And Data

- Keep game rules, payouts, bankroll changes, persistence, and realtime authority out of UI renderers.
- The server owns profiles, credentials, rooms, game actions, settlements, and bankrolls.
- The browser displays server-returned values. It must not recalculate payouts, bankroll changes, or settlement results.
- Parse JSON text with `parseJsonText()` and then parse the exact strict domain schema.
- Do not use `unknown`, `object`, `z.unknown()`, unsafe domain assertions, shallow record checks, or generic JSON checks as proof of a domain type.
- Reject obsolete version fields. Delete invalid SQLite rows and recover invalid browser state to the documented empty state.
- Use deterministic RNG, deck, reel, profile, and data-store fixtures in tests. Do not call `Math.random()` from `src/game/`.

## Security And Multiplayer

- Public tunnel sessions are trusted demos, not production hosting.
- A public `profileId` is not permission to mutate or join as that profile. Use the browser-local profile credential.
- Destructive admin actions require `CASINO_ADMIN_TOKEN`. Keep it out of URLs, logs, room snapshots, and broadcasts.
- Keep profile tokens and admin capability out of `data-state`, room lists, room snapshots, and other broadcast messages.
- Keep external GitHub Actions pinned to full 40-character commit SHAs with same-line version comments.
- Do not weaken CodeQL, Dependency Review, branch protection, action pinning, public-tunnel origin checks, or server authority.

## Pull Requests

- Work from a branch or fork. Do not commit directly to `main`.
- Keep changes focused and use the pull request template.
- Use a conventional title such as `docs(scope): summary`.
- Add at least one `type:*` label and one `area:*` label.
- Add or update tests for behaviour changes. Explain why tests are not needed for docs-only changes.
- Run the relevant local checks and record the exact commands.
- Before calling work complete, inspect the final diff and status, verify the changed surface, and report skipped checks or unresolved risks.

## Optional OpenCodeRAG

OpenCodeRAG is available for repository navigation. Use its semantic search,
file skeleton, usage, and quirk tools when they improve a search. These are
optional project-local aids. The repository source, tests, configuration, and
maintained documentation remain authoritative.
