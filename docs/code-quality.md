# Code Quality and Domain Boundaries

The app is organised by domain first. New modules should go into the narrowest folder that owns the behaviour:

- `src/game/`: pure game engines, card/RNG primitives, payout and settlement rules, slot themes, and catalog data.
- `src/multiplayer/`: realtime protocol, server entrypoint, room authority, heartbeat handling, and room/session coordination.
- `src/state/`: server data persistence, persisted profile/session schemas, and flow state machines.
- `src/schemas/`: Zod schemas for runtime boundaries and persisted envelopes.
- `src/assets/`: asset manifest and asset path helpers.
- `src/audio/`: audio settings and playback service.
- `src/ui/`: rendering primitives, Pixi table, Radix chrome, layout data, and visual-only helpers.
- `src/app/shell/`: the browser application coordinator and DOM event binder.
- `src/app/dom/`: shell template and typed element collection.
- `src/app/views/`: DOM view renderers and view-local controllers.
- `src/app/state/`: app snapshots and player construction for rendering server-owned data.
- `src/app/input/`: DOM input parsing and table hit testing.
- `src/app/format/`: display-only formatting and HTML list rendering.
- `src/app/rooms/`: room defaults and room-specific app constants.
- `tests/unit/<domain>/`: Vitest coverage grouped by the source domain it exercises.
- `tests/e2e/`: Playwright browser workflows.

## Static Checks

`npm run lint` now runs ESLint, TypeScript with `noUnusedLocals` and `noUnusedParameters`, and `npm run architecture:check`.

`scripts/architecture-check.mjs` enforces:

- Game modules cannot import UI, app, or multiplayer modules.
- Multiplayer and state modules cannot import UI or app modules.
- UI modules cannot import the app shell.
- No circular dependencies between source modules.
- No direct `Math.random()` inside `src/game/`; use `src/game/rng.ts` and inject deterministic RNG in tests.
- No direct bankroll property mutation outside `src/game/engine.ts`, `src/multiplayer/roomAuthority.ts`, and `src/state/profiles.ts`.
- No obvious payout or settlement logic duplicated in `src/ui/`.
- One module-scope top-level element per file.
- No vague `utils`, `helpers`, `misc`, or `manager` filenames.
- Files over 700 lines must either be split or listed with a documented exception.
- App modules must live in an approved `src/app/<role>/` folder instead of directly under `src/app/`.
- Tests must live under `tests/unit/<domain>/` or `tests/e2e/`.

## File Responsibility

Prefer one primary class, component, service, state machine, schema group, renderer, config object, or engine per file. Keep tightly coupled small types next to the owner when separating them would make the callsite harder to read.

Current size exceptions:

- `src/multiplayer/roomAuthority.ts`: authoritative multiplayer room coordinator. Future cleanup should split game-specific room handlers while keeping settlement authority server-side.

## Adding Modules

Keep authoritative rules in game, multiplayer authority, or server data-store modules, not in renderers. UI can display returned values and labels but must not recompute payouts, bankroll changes, or settlement outcomes.

Keep persistence behind state modules, assets behind the manifest, audio behind `CasinoAudio`, and realtime messages behind the protocol schema. Tests should use deterministic RNG/deck/reel fixtures when asserting game outcomes.
