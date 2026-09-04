# Architecture

Casino Warehouse is a browser casino arcade that uses fictional credits. The
browser renders the lobby and game surfaces. A small Node.js server owns
profiles, rooms, game actions, settlements, and durable demo data.

## Topology

The browser entry point is `src/main.ts`. Vite builds the client bundle from
this entry point and `src/styles/main.css`. `GameApp` in
`src/app/shell/GameApp.ts` creates the DOM shell, mounts React islands, starts
the Pixi table, binds browser events, and coordinates the client state.

The server entry point is `src/multiplayer/serverEntry.ts`. The server build
uses the same module tree with an SSR Vite build. `createCasinoServer()` in
`src/multiplayer/serverEntry/createCasinoServer.ts` serves the built files,
responds to `/health`, and accepts WebSocket connections at `/ws`.

The server parses each WebSocket message, authorises profile or admin access,
passes valid room actions to `RoomAuthority`, and broadcasts validated room
snapshots and settlements. The HTTP handler injects the runtime WebSocket URL
into the built page when a public tunnel configures one.

## Domain Ownership

- `src/game/` owns pure game rules, cards, random number interfaces, game state, payout rules, settlement calculations, slot themes, and the game catalog.
- `src/game/engine/` owns Beat the House betting, rounds, game state, and settlement. `src/game/blackjack/` owns the standalone Blackjack engine. `src/game/blackjackTable/` owns the multiplayer Blackjack table model. `src/game/slots/` owns slot spins, jackpots, bonuses, and themes.
- `src/multiplayer/protocol/` owns client and server message types. `src/multiplayer/roomAuthority*.ts` and `src/multiplayer/roomAuthorityModel/` own room membership, seats, game models, phases, actions, and settlement coordination.
- `src/multiplayer/serverEntry/` owns the HTTP server, WebSocket lifecycle, message handling, origin checks, and broadcast state.
- `src/state/profiles/` owns profile records, bankroll transactions, House Advance state, and profile parsing. `src/state/session/` owns persisted browser session state. `src/state/serverDataStore/` owns the memory and SQLite data-store implementations.
- `src/state/roomMachines/` owns the XState machines and transition helpers for room flow and shared slot flow.
- `src/schemas/casinoSchemas/` owns strict runtime schemas, branded identifiers, persisted envelopes, numeric boundaries, and JSON parsing. `src/schemas/protocol/` composes the client and server message schemas.
- `src/app/` owns browser coordination. `shell/` coordinates the app, `dom/` owns the template and element collection, `views/` renders DOM views, `state/` creates display players and snapshots, `input/` parses browser input, `format/` formats display text, and `rooms/` owns room defaults.
- `src/ui/` owns Pixi table rendering, layout data, chip and card renderers, visual effects, and React/Radix chrome. UI code displays values returned by game and server owners.
- `src/assets/manifest/` owns asset metadata. `src/assets/tableAssets/` exposes focused asset paths to renderers. `src/audio/casinoAudio/` owns audio settings and playback.

The new Beat the House rule surface is `src/game/beatTheHouse/`. It defines the
six-deck shoe, cut threshold, card limits, dealer rule, and current payout
constants. `src/game/beatTheHouse/settlement/` and `oracle/` provide the new
settlement and simulation contracts used by unit tests and shoe validation.
The running room path still constructs the app-facing
`src/game/engine/BeatTheHouseGame`; keep its integration aligned with the new
rule surface and do not copy rules from the preserved one-deck DOCX. See
[Beat the House rules](beat-the-house-rules.md) for the current values.

## Dependency Direction

The dependency direction keeps rules independent from presentation:

- Game modules must not import UI, app, or multiplayer modules.
- Multiplayer and state modules must not import UI or app modules.
- UI modules must not import the app shell.
- App modules compose game, state, multiplayer, UI, asset, and audio modules.

The architecture checker also rejects circular source dependencies. See
[Code quality](code-quality.md) for the enforced structural rules.

## Authoritative Game Flow

Game engines calculate outcomes. Room authority controls when a player may
perform an action and applies the result to the server data store.

1. A browser view sends a typed client intent through `MultiplayerClient`.
2. `CasinoServerMessageHandler` parses the JSON text with the protocol schema.
3. The handler replaces client-supplied profile details with the authorised server profile for room creation and joining.
4. `RoomAuthority` checks membership, role, seat ownership, phase, wager, and bankroll rules.
5. The game model runs the action. Beat the House uses `BeatTheHouseGame`, Blackjack uses `BlackjackTable`, and slots use `SlotsGame`.
6. `RoomAuthoritySettlement` applies returned credits and House Advance repayment through `ServerDataStore`.
7. `CasinoServerState` broadcasts room state, settlements, room lists, and filtered profile data.
8. The browser validates server messages and renders the returned state through DOM views and Pixi or React surfaces.

The browser copy of a room or profile is not authoritative. UI code must not
recalculate payouts, bankroll changes, or settlement results.

## Rooms And Settlement

`RoomAuthority` keeps room state in memory for the running server. Each room
has a game model, players, spectators, seats, a session identifier, and a
monotonic revision. The constructor also creates the server-managed Beat the
House main room.

Beat the House waits for all room players to signal readiness before dealing
or moving to the next round. Blackjack actions apply to the member's claimed
seat. Shared slots require room players to set wagers and signal readiness
before a spin. Settlement keys and session identifiers prevent duplicate
returns during resynchronisation.

## Persistence And Browser State

`createDefaultServerDataStore()` selects `MemoryServerDataStore` in tests and
`SqliteServerDataStore` in other environments. The default SQLite file is
`.casino/casino.sqlite`; `CASINO_DB_PATH` can select another path. SQLite rows
are parsed with their exact schemas. Invalid stored rows are deleted.

The server owns profile data, bankrolls, ledgers, and profile token hashes. The
browser stores the current session, profile tokens, the admin token when
supplied, the selected realtime URL, and audio settings in
`localStorage`. Browser session data is parsed before it is restored. A saved
room is checked against the server before the app shows it as restored.

Profile tokens and admin capability are not included in data-state, room
snapshots, room lists, or other broadcasts. Profile actions require a token
owned by that browser. Destructive admin actions require the configured
`CASINO_ADMIN_TOKEN`.

## Protocol And Validation

JSON is parsed at the transport boundary by `parseJsonText()`. The protocol
schemas in `src/schemas/protocol/` then validate the complete message shape
with strict Zod schemas. Persisted profile, session, game, room, and asset
data use their corresponding schemas before an engine or store receives them.

Profile, room, connection, session, settlement, and other identifiers use
branded schema types such as `ProfileId` and `RoomId`. Network credit and
finite-number schemas separate transport values from local domain values.

## Client Rendering

The imperative `GameApp` shell owns DOM event binding and view coordination.
Views in `src/app/views/` render lobby, room, profile, wallet, rules, and game
controls. `PixiTable` owns the Beat the House canvas, including table art,
cards, chips, hit zones, animations, and settlement effects. React is limited
to focused islands mounted by `src/ui/radixChrome.tsx`, including setup dialogs
and chip tooltips. `src/ui/radixChrome.tsx` also mounts Radix scroll areas for
long dialog content. Tailwind CSS is loaded through `src/styles/main.css`,
which imports focused files under `src/styles/`, for the DOM surface.

XState is used only for room-phase transition rules in
`src/state/roomMachines/roomFlowMachine.ts` and
`src/state/roomMachines/sharedSlotsFlowMachine.ts`. It does not calculate game
outcomes or replace the game engines.

## Trust Boundaries

The server accepts only text JSON WebSocket messages and rejects invalid
origins before upgrading a connection. A public tunnel must configure the
public base URL so invite links and origin checks use the published host.
Profile credentials authorise profile mutations and room identity. The admin
token authorises bankroll edits, reset-all, and server-data clearing. Public
tunnel sessions are trusted development demos, not production hosting.
