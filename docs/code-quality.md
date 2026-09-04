# Code Quality And Domain Boundaries

Keep code in the narrowest domain that owns the behaviour. `eslint.config.js`,
`tsconfig.json`, `scripts/architecture-check.mjs`, and the scripts imported by
that checker are the source of truth for these rules.

## Domain Map

- `src/game/`: pure game engines, cards, random number interfaces, payouts, settlements, slot themes, and catalog data.
- `src/multiplayer/`: protocol types, WebSocket client/server code, room authority, room models, room limits, and heartbeat handling.
- `src/state/`: profiles, bankroll transactions, browser/server sessions, persistence, and XState room-flow machines.
- `src/schemas/`: Zod schemas for JSON, protocol, persisted state, identifiers, credits, timestamps, and other runtime boundaries.
- `src/assets/`: asset metadata and focused asset path accessors.
- `src/audio/`: audio settings and playback.
- `src/ui/`: Pixi rendering, layout, visual effects, chips, cards, and React/Radix chrome.
- `src/app/shell/`: browser application coordination and event binding.
- `src/app/dom/`: HTML template and typed element collection.
- `src/app/views/`: display-only DOM views and view-local controllers.
- `src/app/state/`: display snapshots and player construction.
- `src/app/input/`: browser input parsing and table hit testing.
- `src/app/format/`: display formatting and HTML list rendering.
- `src/app/rooms/`: room defaults and room-specific app constants.
- `tests/unit/<domain>/`: Vitest tests grouped by source domain.
- `tests/e2e/`: Playwright browser workflows.

## Import Boundaries

The architecture checker enforces these boundaries:

- `src/game/` must not import `src/ui/`, `src/app/`, or `src/multiplayer/`.
- `src/multiplayer/` and `src/state/` must not import `src/ui/` or `src/app/`.
- `src/ui/` must not import `src/app/`.
- Source modules must not form circular dependencies.

Keep game rules, settlement, bankroll, persistence, and realtime authority out
of rendering modules. UI code may display values returned by an owner. It must
not recompute payouts, bankroll changes, or settlement outcomes.

## Module Shape

- Keep one primary module-scope element in each source file. Classes, functions, constants, variables, interfaces, types, enums, schemas, and React components all count.
- Keep file-local details inside their owner or extract them into a focused module.
- Do not add re-export-only barrel files. Import the focused module directly.
- Do not use vague source filenames such as `utils`, `helpers`, `misc`, or `manager`.
- Split source files that exceed 400 lines. The checker applies this limit to `src/**/*.{ts,tsx}` and has no documented size exception.
- Keep app modules under an approved `src/app/<role>/` directory.
- Keep tests under `tests/unit/<domain>/` or `tests/e2e/`.

## TypeScript And Runtime Rules

The ESLint rules and architecture scripts enforce the following rules:

- TypeScript uses `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, and `noUnusedParameters`.
- Do not use the TypeScript `unknown` or `object` types, `z.unknown()`, or non-null assertions. Use a named domain type, a strict guard, a Zod schema, or a fallback.
- Do not use `typeof value === 'object'` as a domain check. Use a schema or a strict property guard.
- Use branded `ProfileId`, `RoomId`, and related identifier types in protocol, profile, and session data.
- Parse JSON text with `parseJsonText()` and then parse the exact domain schema. A generic JSON value, record check, shallow guard, `z.custom()`, or type assertion does not establish a domain type.
- Use strict Zod objects. `z.record()` must define both a key schema and a value schema.
- Do not use unsafe Zod patterns such as `z.any()`, coercive booleans, deprecated number checks, duplicate checks, or throwing refinement callbacks.
- Throw `Error` instances rather than strings or other literal values. Do not use `eval()` or `new Function()`.
- Use the shared `finiteNumberSchema` instead of calling `z.number().finite()` directly.
- State loaders under `src/state/**/load*.ts` must return recovery results. They must not throw when stored data is invalid.

## Game And Money Rules

- Do not call `Math.random()` in `src/game/`. Use the `Rng` interface or the secure random helpers and inject deterministic values in tests.
- Keep bankroll mutation in the authorised game or room/data-store owners. The checker permits direct bankroll property mutation only in `src/game/engine/BeatTheHouseGame.ts`, `src/game/engine/BeatTheHouseState.ts`, and `src/multiplayer/roomAuthority.ts`.
- Route multiplayer settlement through `RoomAuthoritySettlement` and `ServerDataStore`.
- Keep persistence behind `src/state/` modules, assets behind the manifest, audio behind `CasinoAudio`, and realtime messages behind protocol schemas.

## Numeric Values

Name values that define game rules, payouts, room limits, timing, layout,
protocol bytes, schema bounds, or reusable test behaviour in the narrowest
owner. Do not create broad constants buckets.

The magic-number checker permits neutral inline values such as `-1`, `0`,
`0.5`, `1`, and `2`, named declaration initialisers, type values, enum
initialisers, object property values, default parameters, and literal test
data inside test callbacks. Add a same-line
`casino-magic-number-allow: <reason>` comment only for an intentional inline
exception.

## Checks

- `npm run lint:static` runs ESLint and TypeScript type checking.
- `npm run architecture:check` runs the custom architecture checks, Knip, and depcheck.
- `npm run supply-chain:check` runs the repository supply-chain validator.
- `npm run lint` runs all three lint groups.
- `npm run format` checks EditorConfig and Prettier for source, tests, scripts, workflows, and maintained Markdown.
