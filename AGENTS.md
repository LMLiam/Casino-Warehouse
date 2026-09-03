# AGENTS.md

This file provides repository-level guidance for coding agents working on Casino Warehouse.

Explicit user instructions take precedence over this file. A nested `AGENTS.md` applies to its subtree and takes precedence over this file when instructions conflict.

## Project

Casino Warehouse is a source-available, noncommercial, fictional-money casino arcade for desktop and tablet browsers.

The application contains:

- Beat the House;
- Blackjack;
- slots;
- local realtime multiplayer;
- browser-side state;
- a Node.js WebSocket/server runtime; and
- optional SQLite-backed server persistence.

Credits have no cash value. Do not introduce deposits, withdrawals, payments, cryptocurrency, NFTs, cash-out flows, real-money gambling, or commercial-casino positioning.

## Start Here

Read the documentation relevant to the task before changing code:

- `README.md` - setup, runtime, public tunnels, local data, and project scope.
- `CONTRIBUTING.md` - contribution, pull request, testing, and repository workflow.
- `GOVERNANCE.md` - maintainer decision-making and issue triage.
- `docs/code-quality.md` - architecture, source-file structure, static checks, and domain boundaries.
- `docs/supply-chain-security.md` - dependency and GitHub Actions security.
- `docs/architecture-ui-state.md` - UI/application state architecture when working in those areas.

Treat those files and executable checks as the source of truth. Do not duplicate or reinterpret their policies here.

## Environment

Use:

- Node.js 26.x (`>=26.0.0 <27`);
- npm; and
- the versions committed in `package-lock.json`.

Use `npm install` for normal local development. CI uses `npm ci`.

Phone-sized layouts are intentionally unsupported.

## Commands

Common commands:

```bash
npm run dev
npm run dev:full
npm run dev:server
npm run build
npm run build:server
npm run typecheck
npm run format
npm run lint
npm run test
npm run test:coverage
npm run visual
npm run visual:serial
npm run check
```

`npm run dev` starts only the Vite client. Use `npm run dev:server` or `npm run dev:full` when realtime/server behaviour is required.

During implementation, run the narrowest useful test or check first. Before finishing, run the broader checks appropriate to the changed surface.

For changes under `src/ui/`, run `npm run visual:serial`.

For other browser workflow, multiplayer, or visual changes, run the relevant Playwright coverage through `npm run visual`.

Do not state that a command passed unless you ran it successfully. Report skipped or failing checks explicitly.

## Repository Map

Place behaviour in the narrowest domain that owns it:

- `src/game/` - pure game rules, engines, cards, RNG, payouts, settlement logic, slot themes, and game catalog data.
- `src/multiplayer/` - realtime protocol, client/server transport, room authority, membership, settlement, and multiplayer lifecycle.
- `src/state/` - persistence, persisted state, profiles, sessions, and state machines.
- `src/schemas/` - Zod schemas and validated runtime boundaries.
- `src/app/` - browser application coordination, DOM interaction, input, rendering state, room configuration, and views.
- `src/ui/` - visual rendering primitives, Pixi rendering, React/Radix UI, layout, and visual-only behaviour.
- `src/assets/` - asset manifest and asset-path behaviour.
- `src/audio/` - audio configuration and playback.
- `src/styles/` - application styling.
- `src/shared/` - genuinely cross-domain leaf functionality with no narrower owner.
- `tests/unit/<domain>/` - Vitest tests corresponding to source domains.
- `tests/e2e/` - Playwright browser, visual, multiplayer, and public-tunnel workflows.

Do not use `shared` as a dumping ground. Prefer the narrowest domain owner.

## Architecture Invariants

Preserve the existing dependency direction.

In particular:

- Game code must remain independent of UI, application-shell, and multiplayer concerns.
- Multiplayer and state code must not depend on UI or application-shell code.
- UI code must not become authoritative for game or persistence behaviour.
- Keep payout, settlement, bankroll, persistence, and multiplayer authority in their owning domains.
- UI code may display authoritative values but must not independently recompute settlement or bankroll outcomes.
- Keep realtime messages behind their protocol/schema boundary.
- Keep persisted state behind the state/schema boundary.
- Do not introduce circular source dependencies.

Run `npm run architecture:check` rather than reasoning around these constraints manually.

Do not bypass an architecture check to make a change pass. Fix the design instead.

## TypeScript And Module Rules

The repository deliberately applies stricter rules than normal TypeScript projects.

Do not use:

- `unknown`;
- `object`;
- `z.unknown()`;
- assertions through `unknown`;
- non-null assertions (`!`);
- `typeof value === 'object'` as runtime validation;
- `Math.random()` in `src/game/`;
- vague modules such as `utils.ts`, `helpers.ts`, `misc.ts`, or `manager.ts`; or
- barrel/re-export-only modules.

Use named domain types, schemas, runtime guards, and type-safe construction instead.

Use branded domain identifiers such as `ProfileId` and `RoomId` where those concepts are required. Do not degrade them to plain strings.

Keep new source modules focused on one module-scope top-level element. Extract additional module-scope declarations into focused files with domain-specific names.

Name meaningful numeric values in the narrowest owning domain. Use the repository's documented recovery behaviour rather than being silently coerced into current state.

## Game Logic

Game outcomes must be reproducible in tests.

Use the repository RNG abstractions and inject deterministic RNG, deck, or reel behaviour where appropriate. Never introduce `Math.random()` into game-domain code.

Keep game rules and payout behaviour independent of rendering concerns.

When changing Beat the House rules, also consult the authoritative game-rule material under `docs/`.

## Multiplayer And Security

The server is authoritative for multiplayer state and settlement.

Preserve:

- profile ownership checks;
- room authority;
- WebSocket origin validation;
- reconnect and heartbeat behaviour;
- server-side settlement;
- profile credential confidentiality; and
- admin capability boundaries.

`CASINO_ADMIN_TOKEN` is a secret. Do not place admin tokens or profile credentials in logs, URLs, public snapshots, rendered state, documentation examples containing real values, or broadcast protocol messages.

Public tunnels are trusted development/demo infrastructure, not production hosting. Do not weaken origin or authorization controls to make tunnel flows easier.

For GitHub workflow changes, preserve the supply-chain controls documented in `docs/supply-chain-security.md`. External actions must remain pinned to full commit SHAs with the repository's request or the issue being addressed.

Do not modify unrelated working-tree changes.

Do not commit generated output such as:

- `dist/`;
- `dist-server/`;
- coverage output;
- Playwright reports; or
- test artifacts.

Do not commit directly to `main`. Use a branch or worktree for implementation work.

Prefer complete fixes over artificially small diffs. If correctness requires coordinated code, tests, schemas, and documentation changes, update all affected surfaces.

Do not add speculative compatibility layers, abstractions, configuration, or dependencies without a concrete requirement.

Prefer existing repository patterns over introducing a second way to solve the same problem.

## Pull Requests And Issues

When creating or updating GitHub issues or pull requests, follow `CONTRIBUTING.md`, `GOVERNANCE.md`, and the repository templates rather than duplicating their current rules here.

Before presenting implementation work as complete:

1. inspect the final diff;
2. check for correctness, security, architecture, testing, and documentation regressions;
3. run the checks appropriate to the changed surface;
4. confirm no unrelated or generated files were included; and
5. report what was changed, what was tested, and anything that remains uncertain.

Never describe work as complete or ready merely because the code was written.

## Keeping This File Useful

Keep `AGENTS.md` short, stable, and repository-wide.

Put detailed or frequently changing policy in the appropriate repository documentation and link to it from here.

If one subsystem eventually needs substantial agent-specific guidance, add a nested `AGENTS.md` in that subsystem rather than expanding this root file indefinitely.

<!-- BEGIN opencode-rag -->

## Code Navigation

Use OpenCodeRAG tools for code navigation when they provide useful context:

- **Search first** — `search_semantic(query)` instead of grep/glob
- **Skeleton before read** — `get_file_skeleton(filePath)` then read specific lines
- **Usages before edit** — `find_usages(symbolName)` before modifying any symbol
- **Images via describe** — `describe_image(filePath, systemPrompt?)` — never read raw bytes
- **Recall quirks** — `recall_quirks(query)` when you hit a known pitfall
- **Add quirks** — `add_quirk(content)` when you discover a non-obvious fact
- **Fix quirks** — `update_quirk(id, ...)` / `delete_quirk(id)` when a stored quirk is outdated or wrong

If no useful results are available, consider running `opencode-rag index`.

### Decision tree — preferred order

1. User mentions code behavior/architecture → `search_semantic(query)`
2. User mentions a file path → `get_file_skeleton(filePath)` THEN `read` on specific lines
3. User mentions a function/class/variable to edit → `find_usages(symbolName)` THEN `search_semantic` THEN `edit`
4. User asks a code question → `search_semantic` to gather context before answering
5. User asks about an image or visual asset → `describe_image(filePath)` (optionally pass `systemPrompt` to focus on specific features) to retrieve its generated description, then optionally `search_semantic` for related code
6. You encounter an error or need to recall a known pitfall → `recall_quirks(query)`
7. You discover a non-obvious fact or workaround → `add_quirk(content)` to persist it for future sessions
8. A recalled quirk is outdated or wrong → `update_quirk(id, ...)` to fix it, or `delete_quirk(id)` if it no longer applies

### Proactive triggers — prefer these tools when

- User asks about code behavior, architecture, or implementation details
- User asks to edit, refactor, or fix code — call `find_usages` first
- User references files or functions you haven't read yet
- User says "find", "search", "look up", "where is", "how does"
- User refers to an image, screenshot, diagram, or visual asset
- Before answering ANY code-related question, retrieve context first
- Before reading ANY file, call `get_file_skeleton` to orient first

### Anti-patterns — avoid these where practical

- Reading full files without calling `get_file_skeleton` first (wastes tokens)
- Editing a function without calling `find_usages` first (breaks call sites)
- Answering code questions without calling `search_semantic` first (you guess at behavior)
- Using `grep`/`glob` when `search_semantic` would find the answer faster
- Treating image files as text — use `describe_image` instead of reading raw bytes
- Using `npx opencode-rag quirk` shell commands instead of the built-in quirk tools (`add_quirk` / `recall_quirks` / `update_quirk` / `delete_quirk`) (the tools are faster, already loaded in-process, and go through the trust monitor)

### Optional quirk capture rules — consider calling `add_quirk` when

- A build, test, or type-check command fails and you resolve it
- You discover an undocumented library constraint, peer dep, or workaround
- You learn an environment-specific requirement (OS, tool version, etc.)
- You make a design decision that future sessions should remember
- You resolve a gotcha that cost more than one attempt

### Optional quirk hygiene — use `update_quirk` or `delete_quirk` when

- A stored quirk is outdated, wrong, or has been fixed — update it or delete it instead of adding a contradicting duplicate
- Keep durable project knowledge in the project's supported memory store.
<!-- END opencode-rag -->
