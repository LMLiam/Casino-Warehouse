# Coverage Policy

Issue #17 raises the enforced unit coverage floor from `85/80/85/85` to `90/85/90/90` for statements, branches, functions, and lines.

The refreshed implementation run on this branch passed with 273 Vitest tests and:

```text
Statements   : 93.13%
Branches     : 85.15%
Functions    : 94.67%
Lines        : 93.21%
```

## Instrumented Scope

`npm run test:coverage` uses Vitest V8 coverage for unit-testable runtime modules reached by the unit suite. The raised gate covers core game rules, slot configuration, state parsing and persistence, multiplayer protocol/server authority, selected browser control behavior, Pixi chip rendering contracts, and repository tooling validators.

The browser workflow and visual surfaces continue to be covered by Playwright through `npm run visual`, which is the repository gate for full browser interaction, Radix focus behavior, layout, and multiplayer flows.

## Intentional Exclusions

The following paths or path families are intentionally outside the Vitest unit coverage gate, or have CLI-only sections ignored with `v8 ignore`:

- `coverage/**`, `dist/**`, `dist-server/**`, and `node_modules/**`: generated or dependency output.
- `tests/e2e/**`: Playwright specs are run by the visual/e2e gate rather than instrumented by Vitest.
- `src/multiplayer/serverEntry.ts`: SSR entrypoint wrapper; `npm run build:server`, `npm run dev:server`, and server-entry tests cover the server factory it delegates to.
- CLI wiring in `scripts/validate-pr-standards.mjs`, `scripts/validate-issue-standards.mjs`, `scripts/supply-chain-check.mjs`, and `scripts/dev-cloudflare.mjs`: workflow/manual command startup paths; unit tests cover the validator, policy, and launcher contracts directly.
- Browser shell and template modules such as `src/main.ts`, `src/app/dom/**`, `src/app/shell/**`, and view renderers other than `src/app/views/AudioControls.ts`: these are exercised through Playwright workflow coverage rather than node-environment unit instrumentation.
- React/Radix and browser-mounted UI modules such as `src/ui/ChipTooltips.tsx`, `src/ui/SetupDialogs.tsx`, and `src/ui/radixChrome.tsx`: these require browser rendering and focus coverage.
- Pixi renderers other than the chip-rendering contract covered in `tests/unit/app/chip-renderer.test.ts`: richer table rendering remains covered by Playwright snapshots and focused PixiTable unit coverage.
- Public tunnel provider CLIs such as `scripts/dev-public.mjs` and `scripts/dev-localtunnel.mjs`: these depend on external tunnel services; provider-neutral smoke coverage remains in Playwright and provider-specific launcher unit coverage is added for Cloudflare Tunnel.

## Residual Gaps

No high-risk file below the raised global threshold is hidden as complete. Remaining per-file gaps below 80% statement or branch coverage are tracked in follow-up issue [#133](https://github.com/LMLiam/Casino-Warehouse/issues/133), including:

- `src/multiplayer/roomAuthority.ts`: 83.17% statements / 76.49% branches.
- `src/multiplayer/client/MultiplayerClient.ts`: 91.59% statements / 76.04% branches.
- `src/multiplayer/serverEntry/maybeStartServer.ts`: 75.00% statements / 66.66% branches.
- `scripts/codeql-autofix-prs.mjs`: 89.42% statements / 77.04% branches.
- Thin schema/store parser wrappers with meaningful negative-path gaps.
