# UI, Validation, and State Architecture

This app uses Tailwind CSS, Radix Primitives, Zod, and XState as focused architecture tools around the existing PixiJS game surfaces. They should improve DOM maintainability, accessibility, validation, and phase safety without replacing the rendering/game engines.

## Tailwind DOM Design System

Tailwind is wired through `@tailwindcss/vite` and `src/styles/main.css`. `main.css` is an import manifest for focused files in `src/styles/`: theme/root tokens, base elements, setup and lobby screens, table shell layout, game views, HUD controls, room panels, responsive rules, Tailwind component helpers, and Radix chrome. Reusable classes cover panels, buttons, inputs, room cards, status badges, overlays, dialogs, tooltips, and scroll areas.

Use Tailwind-backed DOM utilities for lobby, room browser, setup, dialogs, settings/audio, side panels, admin/debug, ledger, rules, and general app chrome. Keep PixiJS responsible for Beat the House table layout, cards, chips, table hit zones, and animations that depend on `src/ui/layout.ts`.

## Radix Primitives

Radix is adopted as small React islands inside the otherwise imperative TypeScript app. `src/ui/radixChrome.tsx` mounts:

- Dialogs for audio settings, with modal focus management and Escape-to-close.
- ScrollArea wrappers for longer dialog content.
- Tooltips for chip controls.

Keep the custom casino CSS. Do not import a generic visual theme. Add more Radix primitives when they remove custom keyboard/focus/menu/dialog logic.

## Zod Runtime Schemas

Shared schemas live in `src/schemas/casinoSchemas.ts`.

- WebSocket payloads use strict numeric network schemas in `src/multiplayer/protocol.ts`.
- DOM/admin/settings inputs use local coercion helpers before dispatch.
- Profile payloads validate before the server data store accepts or persists them. Browser session snapshots validate before local restore.
- Slot themes and game catalog entries are validated at load time.

Clear validation failures should become user-facing status text, import recovery messages, or server `error` messages instead of silent fallbacks at network/config boundaries.

## Server-Owned Data

The browser keeps a display copy of the latest server `data-state` snapshot, but profile, bankroll, ledger, and room data are owned by `src/state/serverDataStore.ts` and `src/multiplayer/roomAuthority.ts`, then served through `src/multiplayer/serverEntry.ts`. Browser profile-session selection is local to that browser; when it includes a saved room id, the client must rejoin through the server before showing the room as restored. The durable development/demo database is SQLite; tests use the in-memory implementation. User actions cross the realtime protocol as intents, and the server is responsible for accepting, rejecting, persisting, and rebroadcasting the resulting state.

## XState Machines

`src/state/roomMachines.ts` contains the current XState machines:

- `roomFlowMachine`: lobby, betting, playing, settled.
- `sharedSlotsFlowMachine`: collecting wagers, ready to spin, spinning, bonus.

Use machines where invalid transitions matter across multiplayer or game phases. Avoid machines for one-off UI booleans. Do not duplicate engine settlement or card logic in XState; machines should guard legal movement between phases while engines remain the source of game outcomes.

## Test Expectations

Important additions should include focused Vitest coverage for schema failures and machine transitions plus Playwright coverage for Radix keyboard/focus behaviour and tablet layout stability. `npm run check` remains the local quality gate.

## Architecture Enforcement

The architectural rules are enforced by `npm run architecture:check`, which is included in `npm run lint` and therefore in `npm run check`. The checker validates import boundaries, circular dependencies, direct game RNG usage, direct bankroll mutation, UI payout duplication, broad file-size exceptions, vague filenames, one module-scope top-level element per file, and unused source or npm dependency declarations.

See [code-quality.md](code-quality.md) for the current domain map, static-analysis rules, and documented exceptions.
