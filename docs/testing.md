# Testing

Use tests to check observable game, state, protocol, browser, and rendering
behaviour. Keep game and state tests deterministic. Use the repository scripts
instead of calling test runners with different defaults.

## Test Layers

- Unit tests live under `tests/unit/<domain>/` and run in the Node environment through Vitest.
- Browser workflows and visual regression tests live under `tests/e2e/` and run through Playwright.
- Server, protocol, persistence, authorisation, reconnect, and room lifecycle behaviour uses unit or server/client tests with memory stores and deterministic fixtures.
- Browser tests check accessible UI, navigation, visual output, multiplayer flows, and public-tunnel behaviour.

Vitest uses globals and excludes `tests/e2e/`, `dist/`, `node_modules/`, and
`.opencode/`. Coverage excludes generated output, dependencies, the server
entry wrapper, and browser tests. The server entry wrapper is exercised by
server builds and browser workflows rather than unit coverage.

Selected V8 ignore blocks cover process and platform wiring that unit tests do
not control. These blocks cover the `dev-cloudflare` launcher, pull request and
issue validator command entry points, supply-chain command wiring, server
startup in `maybeStartServer`, and platform-dependent WebSocket error timing.
The comments identify the manual workflow or focused tests that cover each
ignored block.

## Unit Tests And Coverage

Run the complete unit suite with:

```bash
npm test
```

Run the suite with V8 coverage with:

```bash
npm run test:coverage
```

The global minimums are:

| Metric     | Minimum |
| ---------- | ------: |
| Statements |     90% |
| Branches   |     85% |
| Functions  |     90% |
| Lines      |     90% |

The Beat the House settlement tree at
`src/game/beatTheHouse/settlement/**` has a 95% minimum for statements,
branches, functions, and lines. Keep this stricter threshold because settlement
results change credits and House Advance state.

Use injected random number generators, decks, reel values, profiles, and
memory data stores in unit tests. Do not rely on `Math.random()`, wall-clock
timing, or the local SQLite file when a deterministic fixture can express the
case.

Run one focused unit file when iterating:

```bash
npm run test -- tests/unit/assets/assets-manifest.test.ts
```

Vitest does not run e2e files. Use `npm run visual` for browser tests.

## Browser Tests

`playwright.config.ts` uses `tests/e2e/` as the test directory. The default
base URL is `http://127.0.0.1:4173`. Set `PLAYWRIGHT_HOST` or
`PLAYWRIGHT_PORT` when the test server must use another address. The normal
worker count is two; set `PLAYWRIGHT_WORKERS` to change it.

The web server builds the client and server, then runs:

```bash
HOST=<host> PORT=<port> CASINO_BEAT_NEXT_ROUND_TIMEOUT_MS=3600000 npm run dev:server
```

The two browser projects are:

| Project  | Viewport   | Scope                                                   |
| -------- | ---------- | ------------------------------------------------------- |
| `laptop` | `1366x768` | Visual, workflow, and multiplayer tests                 |
| `tablet` | `1024x768` | Visual and workflow tests; excludes public-tunnel smoke |

Run all browser tests with:

```bash
npm run visual
```

Run them with one worker when debugging shared state or a visual change:

```bash
npm run visual:serial
```

For a focused visual check, use the project and suite explicitly:

```bash
npm run visual -- --project=laptop tests/e2e/casino-visual.spec.ts
npm run visual -- --project=tablet tests/e2e/casino-visual.spec.ts
```

## CI E2E Matrix

`scripts/ci-e2e-matrix.mjs` is the single source of truth for the
`Project Checks` browser matrix. It validates suite paths and emits these
lanes:

| Lane               | Project  | Suites                                                    | Shards |
| ------------------ | -------- | --------------------------------------------------------- | -----: |
| Laptop Visual      | `laptop` | `casino-visual.spec.ts`                                   |      1 |
| Tablet Visual      | `tablet` | `casino-visual.spec.ts`                                   |      1 |
| Laptop Multiplayer | `laptop` | `multiplayer-flow.spec.ts`, `public-tunnel-smoke.spec.ts` |      2 |

CI runs each emitted lane with one Playwright worker. It selects
`npm run visual:serial` when the change includes `src/ui/`; other changes use
`npm run visual`. The aggregate `Required Quality Gate` fails when any quality,
architecture, coverage, or browser lane fails.

To inspect the configured matrix and shard balance:

```bash
node scripts/ci-e2e-matrix.mjs
node scripts/ci-e2e-matrix.mjs --report-balance
```

To reproduce the multiplayer lane locally:

```bash
npm run visual -- --workers=1 --project=laptop --shard=1/2 tests/e2e/multiplayer-flow.spec.ts tests/e2e/public-tunnel-smoke.spec.ts
```

The multiplayer suite creates an ephemeral realtime server and fresh browser
contexts for each scenario. Do not replace those fixtures with shared users or
the persistent local database.

## Public-Tunnel Smoke

The public-tunnel smoke test is skipped unless a trusted live tunnel URL is
provided. Prefer `PUBLIC_TUNNEL_SMOKE_URL`:

```bash
PUBLIC_TUNNEL_SMOKE_URL=https://example.trycloudflare.com npm run visual -- --project=laptop tests/e2e/public-tunnel-smoke.spec.ts
```

`NGROK_SMOKE_URL` remains an ngrok-specific alias for existing workflows. Do
not use a historical tunnel URL as test evidence.

## Full Local Check

Run the same broad local sequence as CI and the repository check script:

```bash
npm run format
npm run lint
npm run test:coverage
npm run build:server
npm run visual
```

`npm run check` runs those stages in order. It does not run the standalone
`npm test` command because coverage already runs the unit suite.
