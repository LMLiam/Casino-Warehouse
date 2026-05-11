# Casino Warehouse

Casino Warehouse is a fictional-money desktop/tablet casino arcade built with TypeScript, Vite, Tailwind CSS, Radix Primitives, Zod, XState, PixiJS, Web Audio, Vitest, Playwright, and a small native Node WebSocket server.

It is a development/demo app only. Credits have no cash value. There are no deposits, withdrawals, payment systems, crypto, NFTs, or cash-out flows.

## Run Locally

```bash
npm install
npm run build
npm run dev:server
```

For a single built app plus realtime server:

```bash
npm run dev:full
```

`npm run dev` and `npm run dev:client` start only the Vite client shell. The app now expects a realtime server for profile, bankroll, session, and room data, so a client-only shell will show the reconnecting screen unless `localStorage.casino_realtime_url` points to a running server.

The realtime server defaults to `http://127.0.0.1:8787` and WebSocket path `/ws`. Browsers use same-origin `/ws` by default when the integrated server serves the app.

Server-owned data is persisted with SQLite by default at `.casino/casino.sqlite`. Set `CASINO_DB_PATH=/path/to/casino.sqlite` to choose a different file. Unit tests use the in-memory store.

If you want an auto-rebuilding Vite client while keeping server-owned data, run both processes:

```bash
npm run dev
HOST=127.0.0.1 PORT=8787 npm run dev:server
```

## ngrok Multiplayer

For public device testing, run the integrated public dev script:

```bash
npm run dev:public
```

`npm run dev:public` builds the client and server, opens an integrated `@ngrok/ngrok` HTTPS tunnel to the local server port, prints the public app URL and WebSocket URL, then starts the local multiplayer server bound to `0.0.0.0`. Share the printed app URL with another desktop/tablet device.

Alias:

```bash
npm run dev:ngrok
```

ngrok setup:

```bash
export NGROK_AUTHTOKEN=YOUR_TOKEN
npm run dev:public
```

The tunnel runs through the npm package, so a separate `ngrok` binary is not required. You can override the local server port/host, the upstream address sent to ngrok, or a reserved ngrok domain:

```bash
PORT=8787 HOST=0.0.0.0 NGROK_ADDR=127.0.0.1:8787 NGROK_DOMAIN=your-domain.ngrok-free.app npm run dev:public
```

When a game room is created through `dev:public`, the server includes the selected game and public ngrok URL in the invite path. Other devices can open the printed URL, create/select a profile, and join that specific game room as a player or spectator. WebSockets use the same public host at `/ws`.

ngrok publicly exposes the local development server. This is demo hosting, not production security.

### Multiplayer Smoke Checklist

Use this checklist before calling a multiplayer build accepted:

- Device A creates/selects one profile and creates a room for the selected game.
- Device B opens the ngrok URL, creates/selects a different profile, refreshes the selected game's room browser, and joins the same game room as a player or spectator from the room card.
- Both devices show the same room id, players, selected game, and seat assignments.
- Each device can control only its own assigned seat.
- Chip placements appear on both devices in realtime.
- Deal, hit, stick, dealer reveal, and settlement progress in the same order on both devices.
- Each profile receives only its own bankroll and ledger updates.
- Refreshing either device and using resync restores room state without duplicating settlement payouts.

Record the final acceptance evidence in [docs/ngrok-smoke-report.md](docs/ngrok-smoke-report.md).

## Architecture

- `src/app/shell/GameApp.ts`: browser application coordinator that composes app views, event binding, server data snapshots, audio, wallet, and player action dispatch.
- `src/app/dom/`: static DOM shell markup and typed DOM element collection for the app coordinator.
- `src/app/views/`, `src/app/state/`, `src/app/input/`, `src/app/format/`, and `src/app/rooms/`: feature-scoped app modules kept out of the shell.
- `src/game/*`: pure/testable game engines and shared card/slot/catalog primitives.
- `src/state/profiles.ts`: versioned profile store, profile colors, bankroll, stats, per-game stats, ledger, and schema validation.
- `src/state/session.ts`: versioned browser-local session snapshot validation and normalization.
- `src/state/serverDataStore.ts`: server-owned profile persistence with SQLite as the durable default and an in-memory test store.
- `src/state/roomMachines.ts`: XState machines for multiplayer room flow and shared Slots spin readiness.
- `src/schemas/casinoSchemas.ts`: shared Zod schemas for realtime payloads, save/session envelopes, settings, admin numeric inputs, slot themes, and catalog entries.
- `src/multiplayer/protocol.ts`: versioned runtime-validated realtime message schema.
- `src/multiplayer/roomAuthority.ts`: authoritative room/session layer for per-game multiplayer rooms, seat ownership, bankroll debits, turns, and settlement.
- `src/multiplayer/serverEntry.ts`: native Node HTTP/WebSocket server for ngrok/device multiplayer testing.
- `src/ui/*`: Pixi table rendering, chips, cards, effects, data-driven layout, and Radix-powered DOM chrome islands.
- `src/styles/main.css`: Tailwind entrypoint, casino design tokens, reusable DOM UI utilities, and Pixi-safe game surface CSS.
- `tests/unit/<domain>/` and `tests/e2e/`: domain-grouped unit coverage and browser workflow coverage.

More detail on these conventions lives in [docs/architecture-ui-state.md](docs/architecture-ui-state.md) and [docs/code-quality.md](docs/code-quality.md).

## UI, Validation, and State Conventions

Tailwind owns the DOM design system. Casino tokens are defined in `src/styles/main.css` with shared colour, radius, shadow, typography, spacing, panel, button, card, status, overlay, dialog, tooltip, and scroll-surface styling. Keep PixiJS table/card/chip rendering in Pixi and avoid moving table geometry into DOM utilities.

Radix Primitives are used incrementally for accessible DOM chrome where they add real behaviour. Current Radix islands cover setup dialogs, modal focus/Escape behaviour, scroll areas, and chip tooltips while preserving the custom casino styling. Future dialogs, tabs, popovers, selects, switches, menus, and tooltip-style controls should use Radix when custom keyboard and focus management would otherwise be hand-rolled.

Zod schemas live at runtime boundaries. Realtime WebSocket messages are strict about network payload types, while local DOM input helpers coerce user-entered strings into credits before sending typed messages. Save/session envelopes, profile imports, audio settings, admin/debug amounts, slot themes, and catalog entries should validate through `src/schemas/casinoSchemas.ts` before being trusted.

XState is reserved for flows with meaningful phase rules. Multiplayer room phases and shared Slots readiness/spin flow are modelled in `src/state/roomMachines.ts`; trivial local toggles should stay as ordinary state. When adding game flow machines, keep the engine independent, avoid duplicating settlement logic, and call the machine at the authority/session boundary where invalid transitions need to be rejected.

## Game Catalog

The lobby renders from `gameCatalog` in `src/game/catalog.ts`. To add a game, register a `GameCatalogEntry` with id, title, kind, description, accent, rules, paytable, and optional slot theme. To add a slot, add a `SlotTheme` to `slotThemes`; the catalog maps slot themes into lobby entries automatically. Catalog and slot theme data are Zod-validated during module load so malformed configuration fails early.

Included games:

- Beat the House
- Blackjack
- Neon Vault Slots
- Lunar Riches Slots
- Gremlin Vault Slots
- House of Sevens Slots

## Profiles, Rooms, Sessions

Profiles are server-owned and contain bankroll, profile color, stats, per-game stats, and ledger entries. The browser receives `data-state` snapshots for display and sends profile/admin requests to the server when the user acts.

Rooms are realtime multiplayer containers owned by the authoritative server. Each room belongs to exactly one selected game and tracks room id, host profile, player/spectator members, seat assignments, room status, and room revision. The normal UI is room-browser driven: select a game, open Game Rooms, create a room or refresh that game's room list, then join or spectate from a room card. Direct invite links can still deep-link into a selected game room.

Sessions are browser-local profile selections with optional room reconnect targets. On reload, the browser restores only its own selected profile ids, then asks the authoritative server to rejoin the saved room; if that room no longer exists, the client returns to the game lobby. Multiplayer Beat the House, Blackjack, and Slots room state lives on the server, and clients send intents only.

Blackjack multiplayer uses one shared dealer and up to five player seats. Each occupied seat has its own wager, hand state, turn, result, settlement, and profile bankroll update.

Slots multiplayer uses one shared room spin outcome. Each player sets their own wager, marks ready, and the room spins only after all active players are ready. The shared outcome settles independently against each player's wager.

## Ledger Model

Money is integer fictional credits. Every bankroll change records a transaction with id, profile id, timestamp, game id, optional room/session id, type, amount, balance before/after, description, and metadata. Types include wager, payout, push refund, bonus, admin adjustment, reset, import, and correction.

## Realtime Protocol

Client messages are versioned and Zod runtime-validated:

- `create-room`
- `join-room`
- `list-rooms`
- `leave-room`
- `assign-seat`
- `place-chip`
- `clear-bets`
- `rebet`
- `start-round`
- `player-action`
- `blackjack-deal`
- `blackjack-action`
- `slots-wager`
- `slots-ready`
- `slots-spin`
- `slots-pick-bonus`
- `next-round`
- `admin-debug`
- `resync`
- `request-data`
- `create-profile`
- `rename-profile`
- `delete-profile`
- `save-session` (legacy server snapshot compatibility)
- `admin-bankroll`
- `admin-reset-all`
- `clear-server-data`
- `heartbeat-ack`

Server messages are `server-hello`, `reload-required`, `data-state`, `heartbeat`, `room-created`, `room-list`, `room-state`, `settlement`, and `error`. Reconnecting clients include their last server instance id; if the server has restarted, it returns `reload-required` so the browser refreshes the HTML/CSS bundle before resuming.

The server validates profile data mutations, admin bankroll changes, room membership, duplicate profile connections, game-scoped room joins, seat ownership, chip legality, Blackjack turn ownership, Slots readiness, per-player bankroll sufficiency, room admin permissions, and duplicate settlement.

## RNG and Replay

Game engines accept deterministic RNG/deck/reel fixtures for tests and debug. Normal solo play uses runtime deck/reel generation. Multiplayer outcomes are generated by the authoritative room layer, not by clients. Important deterministic outcomes are covered in tests.

## Assets

Assets are tracked through `src/assets/manifest.ts`. Beat the House uses the approved `public/assets/beat-the-house/table.png` table and `public/assets/common/chips-sheet.png` chip sheet, while lobby, tile, Blackjack, and slot frame art live as generated PNGs under `public/assets`. The current asset status and prompts are tracked in [docs/assets-needed.md](docs/assets-needed.md).

## Tests and Quality

```bash
npm run typecheck
npm run architecture:check
npm run test
npm run visual
npm run build:server
npm run check
```

`npm run check` runs lint, TypeScript, architecture checks, formatting, unit/integration tests with coverage, server build, client build, and Playwright visual/layout checks.

`npm run architecture:check` enforces the domain boundaries documented in [docs/code-quality.md](docs/code-quality.md): no forbidden UI/game/multiplayer imports, no circular source dependencies, no direct `Math.random()` in game engines, no direct bankroll mutation outside authorised modules, no payout logic duplicated in UI, no vague utility filenames, and documented exceptions for files over the size limit.

Coverage target is business-rule coverage. `npm run test:coverage` is configured for the thresholds in `GOAL.md`; install the Vitest coverage provider if your checkout does not already have it.

## Known Limitations

- Phone gameplay is intentionally unsupported; phone-sized screens show a clear message.
- The WebSocket server is intentionally lightweight for local/ngrok demos and is not a hardened production service.
- The SQLite store is a single demo namespace, not authenticated multi-user account storage.
