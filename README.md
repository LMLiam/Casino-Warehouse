# Casino Warehouse

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/LMLiam/Casino-Warehouse/badge)](https://scorecard.dev/viewer/?uri=github.com/LMLiam/Casino-Warehouse)

Casino Warehouse is a fictional-money casino arcade for desktop and tablet browsers. It includes Beat the House, Blackjack, and slots rooms with local multiplayer through a small Node server.

This is a demo game. Credits have no cash value, and the app has no deposits, withdrawals, payments, crypto, NFTs, or cash-out flow.

## Project Status

Casino Warehouse is a public, source-available, noncommercial demo project. You may read, run, study, and contribute to the code under the terms of the [PolyForm Noncommercial License 1.0.0](LICENSE), but public availability does not grant commercial use rights.

External contributions are welcome when they fit the demo's scope, especially documentation, tests, accessibility improvements, security fixes, bug fixes, gameplay polish, and repository tooling. Larger feature or policy changes should start as an issue so maintainers can confirm the direction before implementation.

The package is marked `"private": true` in `package.json` intentionally. Casino Warehouse is meant to be installed and run from the repository checkout, and the private package flag helps prevent accidental npm publication; it does not change the public repository status or the noncommercial license.

Maintainer decision-making, issue triage, and pull request review expectations are documented in [GOVERNANCE.md](GOVERNANCE.md).

## Requirements

- Git
- Node.js 26.x. Use `nvm use` or your version manager's equivalent to read the pinned version from `.nvmrc` or `.node-version`.
- npm
- A desktop or tablet browser

Node.js 26 is the supported development/runtime line for this demo. It is a Current release line rather than an LTS recommendation for production applications.

Phone-sized screens are intentionally unsupported.

## Download

```bash
git clone https://github.com/LMLiam/Casino-Warehouse.git
cd Casino-Warehouse
npm install
```

If you downloaded the project as a ZIP, extract it, open a terminal in the extracted folder, then run `npm install`.

## Run

Build the app and start the realtime server:

```bash
npm run build
npm run dev:server
```

Open the local URL printed by the server. By default, this is:

```text
http://127.0.0.1:8787
```

For a one-command built app plus realtime server:

```bash
npm run dev:full
```

Destructive admin controls are locked unless the server has an admin token. To enable them for a local maintenance session:

```bash
CASINO_ADMIN_TOKEN=change-me npm run dev:server
```

Enter the same token in the app's admin panel to unlock bankroll edits, reset-all, and clear-server-data for that browser.

## Play on Another Device

To share a temporary public URL for another desktop or tablet, use one of the integrated public tunnel flows.

For localtunnel:

```bash
npm run dev:localtunnel
```

For ngrok:

```bash
export NGROK_AUTHTOKEN=YOUR_TOKEN
npm run dev:ngrok
```

`npm run dev:public` remains an alias for the ngrok-backed flow. Both provider commands build the app and server, open a public tunnel to the integrated server port, print the app URL and WebSocket URL, and route invite links through the public URL. Share the printed app URL with the other device. The public tunnel stays open only while the command is running.

Public tunnels expose your local development server to the internet while they are running. Use them only for trusted demo sessions. localtunnel is convenient because it does not require an ngrok account token, but public service reliability can vary, requested custom subdomains are not guaranteed, browser users may see a localtunnel reminder page before the app, and self-hosting localtunnel or using a paid/stable tunnel provider may be better for recurring sessions. The public `loca.lt` service can also return timeouts or run out of forwarding sockets while the local server is healthy, especially when browser asset requests and multiplayer WebSockets overlap; `npm run dev:localtunnel` prints a warning when its public health probe fails. You can request a localtunnel subdomain with `LOCALTUNNEL_SUBDOMAIN=your-name npm run dev:localtunnel`; use `LOCALTUNNEL_HOST` only when you intentionally target a compatible self-hosted localtunnel server. Set `LOCALTUNNEL_HEALTH_TIMEOUT_MS` to adjust the startup public health probe timeout.

Public tunnel sessions use three separate trust checks. WebSocket upgrades require an `Origin` header from a local development origin or from the configured public base URL; the integrated tunnel flows configure that base URL from the printed app URL. If you expose the server through another public tunnel, set `PUBLIC_BASE_URL` to that app URL before starting `npm run dev:server`. There is no development bypass for missing or unexpected WebSocket origins.

Server-created profiles receive browser-local profile credentials, so another browser can see public server profiles but cannot rename, delete, save with, host as, or join rooms as a profile it does not own. Destructive admin actions require `CASINO_ADMIN_TOKEN`; leave it unset for public demos that do not need admin controls, or set a temporary token and share it only with trusted maintainers.

## Local Data

Casino Warehouse stores demo profiles, bankrolls, ledgers, and room data in SQLite at:

```text
.casino/casino.sqlite
```

To store the database somewhere else:

```bash
CASINO_DB_PATH=/path/to/casino.sqlite npm run dev:server
```

To reset local demo data, stop the server and remove the SQLite file.

## Updating

```bash
git pull
npm install
npm run build
npm run dev:server
```

## Troubleshooting

- If the app stays on a reconnecting screen, make sure `npm run dev:server` or `npm run dev:full` is running.
- `npm run dev` starts only the Vite client shell. Use it alongside a running server, or use `npm run dev:server` for the normal local app.
- If multiplayer devices cannot join each other, create a fresh room after both devices open the same local, ngrok, or localtunnel URL.
- If dependencies fail to install, confirm your Node version matches the requirement above.
- Development tools may emit Node 26 warnings from upstream packages, including `DEP0205` for `module.register()`, Vitest's localStorage warning, or color-environment warnings from Playwright web-server output. These are non-blocking toolchain warnings when the documented checks pass.

## Project Wiki

Architecture notes, protocol details, asset provenance, quality gates, and contributor-facing documentation live in the GitHub Wiki:

https://github.com/LMLiam/Casino-Warehouse/wiki

## License

Casino Warehouse is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use is not permitted, even though the repository is public.
