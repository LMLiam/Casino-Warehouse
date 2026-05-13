# Public Tunnel Multiplayer Smoke Report

Final acceptance evidence for the public tunnel multiplayer run. The recorded run below used ngrok; the smoke test now accepts the provider-neutral `PUBLIC_TUNNEL_SMOKE_URL` environment variable for ngrok, localtunnel, or another compatible public tunnel. The legacy `NGROK_SMOKE_URL` variable still works for existing ngrok notes and automatically applies ngrok's browser-warning skip header. The same smoke test applies localtunnel's `bypass-tunnel-reminder` header only for `loca.lt` and `localtunnel.me` URLs.

## Run Details

- Date: 2026-05-04 22:32 BST
- Tester: Codex
- Server command: `npm run dev:public`
- ngrok command: started by `scripts/dev-public.mjs` through the integrated `@ngrok/ngrok` package
- ngrok URL: `https://ferocity-hasty-landowner.ngrok-free.dev`
- Device A browser/device: Playwright desktop browser context, 1366x768 viewport, through ngrok URL
- Device B browser/device: Playwright tablet browser context, 1024x768 viewport, through ngrok URL
- Historical smoke URL environment: `NGROK_SMOKE_URL=https://ferocity-hasty-landowner.ngrok-free.dev`
- Current equivalent smoke command: `PUBLIC_TUNNEL_SMOKE_URL=https://ferocity-hasty-landowner.ngrok-free.dev npx playwright test tests/e2e/public-tunnel-smoke.spec.ts`
- Latest result: laptop smoke passed in 24.6s; tablet project skipped because the spec creates its own tablet context.

## Evidence Checklist

| Requirement                                                | Evidence                                                                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device A created/selected a profile                        | The recorded ngrok smoke run created `Desktop Smoke`.                                                                                                                                             |
| Device A hosted a room                                     | Browser smoke hosted a room through `wss://ferocity-hasty-landowner.ngrok-free.dev/ws`; latest integrated `dev:public` Playwright smoke completed in 24.6s.                                       |
| Device B opened the ngrok URL                              | Browser smoke opened a separate tablet context at the same public ngrok URL.                                                                                                                      |
| Device B created/selected a different profile              | Browser smoke created `Tablet Smoke` in an independent browser context.                                                                                                                           |
| Device B joined from the selected game room browser        | Browser smoke refreshed the selected game's room browser and joined the desktop-hosted room from its room card over the public tunnel.                                                            |
| Both devices showed the same room state                    | Browser smoke asserted room status and shared seat state on both contexts.                                                                                                                        |
| Seats were assigned                                        | Browser smoke asserted `Left: Desktop Smoke` and `Centre: Tablet Smoke` after automatic room-browser join assignment.                                                                             |
| Each device could control only its own seat                | WebSocket smoke room `S41PAB` rejected tablet attempting to bet on desktop's left seat with `You can only bet on your own seat.`                                                                  |
| Bets appeared on both devices in realtime                  | Browser smoke asserted tablet saw desktop's `£25` table wager; WebSocket smoke room `S41PAB` reported `syncedBet: 25`.                                                                            |
| Round progression was synchronised                         | WebSocket round smoke room `BHXGBM` delivered 8 desktop room-state messages and 7 tablet room-state messages through the public tunnel before settlement.                                         |
| Dealer cards revealed in the same order                    | WebSocket round smoke room `BHXGBM` ended with dealer cards `7 hearts`, `A diamonds` in the shared settled room state.                                                                            |
| Settlement matched on both devices                         | WebSocket round smoke room `BHXGBM` emitted settlement session `session-mormjdm8-nh7dpg` with left returned `50` and right returned `0`.                                                          |
| Each profile received only its own bankroll/ledger updates | WebSocket smoke room `S41PAB` showed desktop bankroll `975` after its `25` wager while tablet remained `900`; settlement payloads were keyed to `desktop-round` and `tablet-round` independently. |
| Refresh/resync did not duplicate payouts                   | Browser smoke reloaded the tablet context, refreshed the room browser, rejoined the same room, and asserted the existing `£25` wager remained.                                                    |

## Notes

- Errors observed: This pass tightened the smoke to wait for durable room-code state after hosting, avoiding an unstable status-text race during public tunnel startup.
- Screenshots/recordings: Playwright retained traces only for failed intermediary runs; final command passed.
- Follow-up fixes needed: None from the final smoke run.
- To run the same smoke through localtunnel, start `npm run dev:localtunnel`, then run `PUBLIC_TUNNEL_SMOKE_URL=<printed app URL> npx playwright test tests/e2e/public-tunnel-smoke.spec.ts`.
- The public `loca.lt` service is best-effort. On 2026-05-13, its tunnel assignment endpoint reported `max_conn_count: 2`; a single localtunnel could be exhausted by two multiplayer WebSockets and then time out on `/health` or reload traffic. The integrated localtunnel flow now uses separate app and WebSocket tunnels plus startup probes to avoid that socket starvation.
