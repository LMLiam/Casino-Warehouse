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

`npm run lint` runs static ESLint and TypeScript checks, the architecture check, and supply-chain checks. The architecture check also runs Knip for unused files, exports, types, and dependencies, then runs depcheck for unused npm dependencies.

`eslint.config.js` enforces syntax-level bans with `no-restricted-syntax`:

- No `unknown` or `object` types, no `z.unknown()`, no `as unknown` casts — use named domain types, runtime type guards, or schemas.
- No non-null assertions (`!`) — use a guard or fallback.
- No `typeof x === 'object'` — use a Zod schema (`cardSchema.safeParse`) or a strict `in` guard (`'bets' in snapshot`), see `src/multiplayer/roomAuthorityModel/timeoutWithUnrefSchema.ts:4`.
- No `Math.random()` inside `src/game/` — use `src/game/rng.ts` and inject deterministic RNG in tests.
- No literal throws. State loader modules under `src/state/**/load*.ts` must return recovery results instead of throwing on invalid saved data.
- Zod schemas must avoid unsafe or deprecated patterns, including `z.any()`, `z.coerce.boolean()`, deprecated number checks, duplicate checks, and throwing from refinement callbacks.
- `src/game/` cannot import `src/ui/`; the ESLint strict-dependencies rule checks relative and root-based imports.

`scripts/architecture-check.mjs` enforces domain and structural rules:

- Game modules cannot import UI, app, or multiplayer modules.
- Multiplayer and state modules cannot import UI or app modules.
- UI modules cannot import the app shell.
- No circular dependencies between source modules.
- No direct bankroll property mutation outside `src/game/engine.ts`, `src/multiplayer/roomAuthority.ts`, and `src/state/profiles.ts`.
- No obvious payout or settlement logic duplicated in `src/ui/`.
- One module-scope top-level element per file.
- No vague `utils`, `helpers`, `misc`, or `manager` filenames.
- Files over 400 lines must either be split or listed with a documented exception.
- App modules must live in an approved `src/app/<role>/` folder instead of directly under `src/app/`.
- Tests must live under `tests/unit/<domain>/` or `tests/e2e/`.
- No unexplained magic numbers in checked TypeScript, TSX, or repository tooling scripts.
- Knip and depcheck must report no unused source declarations or npm dependencies. The depcheck command ignores packages used through npm hook configuration or Tailwind configuration where static dependency detection cannot see the usage.

## Magic Numbers

Numeric values that define game rules, payout multipliers, room limits, timing thresholds, layout offsets, binary protocol bytes, schema bounds, or test helper behaviour must be named where they are owned. Prefer domain constants, class-private constants, focused config objects, or test fixture constants near the behaviour they explain.

The architecture checker scans `src/**/*.{ts,tsx}`, `tests/**/*.ts`, and `scripts/**/*.mjs`. Inline numeric literals are allowed only when they are:

- neutral values such as `-1`, `0`, `0.5`, `1`, or `2` used for arithmetic, indexes, or simple binary choices;
- values in named `const` declarations, readonly/static class properties, enum members, object config properties, type literals, or default parameters;
- literal test-case data inside `it`/`test`/`describe` callbacks, where the test title and matcher explain the example;
- an intentional local exception on the same line with `casino-magic-number-allow: <reason>`.

Do not create broad `constants.ts` buckets. Keep constants in the narrowest domain owner, such as game rule modules, renderer config objects, multiplayer protocol helpers, state/schema boundaries, or focused test fixtures.

## File Responsibility

Prefer one primary class, component, service, state machine, schema group, renderer, config object, or engine per file. Keep tightly coupled small types next to the owner when separating them would make the callsite harder to read.

Current size exceptions:

- `src/multiplayer/roomAuthority.ts`: authoritative multiplayer room coordinator. Future cleanup should split game-specific room handlers while keeping settlement authority server-side.

## Adding Modules

Keep authoritative rules in game, multiplayer authority, or server data-store modules, not in renderers. UI can display returned values and labels but must not recompute payouts, bankroll changes, or settlement outcomes.

Keep persistence behind state modules, assets behind the manifest, audio behind `CasinoAudio`, and realtime messages behind the protocol schema. Tests should use deterministic RNG/deck/reel fixtures when asserting game outcomes.
