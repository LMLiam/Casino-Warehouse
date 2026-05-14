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

For Cloudflare Tunnel quick tunnels:

```bash
npm run dev:cloudflare
```

`npm run dev:cloudflared` is an alias for the same Cloudflare-backed flow, and `npm run dev:public` remains an alias for the ngrok-backed flow. All provider commands build the app and server, print the app URL and WebSocket URL, and route invite links through the public URL. Share the printed app URL with the other device. The public tunnel stays open only while the command is running. The localtunnel flow opens separate public tunnels for app pages and WebSocket traffic so two multiplayer clients do not exhaust the public service's limited forwarding sockets during reloads.

Public tunnels expose your local development server to the internet while they are running. Use them only for trusted demo sessions. localtunnel is convenient because it does not require an ngrok account token, but public service reliability can vary, requested custom subdomains are not guaranteed, browser users may see a localtunnel reminder page before the app, and self-hosting localtunnel or using a paid/stable tunnel provider may be better for recurring sessions. The public `loca.lt` service can also return timeouts while the local server is healthy; `npm run dev:localtunnel` retries startup probes before printing URLs. You can request localtunnel names with `LOCALTUNNEL_SUBDOMAIN=your-name npm run dev:localtunnel`, `LOCALTUNNEL_APP_SUBDOMAIN=your-name`, or `LOCALTUNNEL_WS_SUBDOMAIN=your-name-ws`; use `LOCALTUNNEL_HOST` only when you intentionally target a compatible self-hosted localtunnel server. Set `LOCALTUNNEL_HEALTH_TIMEOUT_MS` or `LOCALTUNNEL_STARTUP_ATTEMPTS` to adjust startup probing.

Cloudflare quick tunnels are useful when you have the `cloudflared` binary installed and want a temporary public HTTPS URL without an ngrok account or a localtunnel service dependency. `npm run dev:cloudflare` runs `cloudflared tunnel --url http://127.0.0.1:<port>`, waits for the generated `https://*.trycloudflare.com` URL, then starts the integrated server with `PUBLIC_BASE_URL` set to that HTTPS URL so invite links and browser WebSocket URLs derive from the Cloudflare hostname. Quick tunnels are intended for development and testing, generate random `trycloudflare.com` URLs, have no uptime SLA, have a 200 in-flight request limit, and do not support Server-Sent Events. Install or update `cloudflared` from the [Cloudflare downloads documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) before using this flow.

For stable Cloudflare hostnames, use a named Cloudflare Tunnel instead of a quick tunnel. Named tunnels and custom hostnames require a Cloudflare account and a domain configured in Cloudflare. Configure a public hostname route that points to the local service, for example `http://localhost:8787`, run that named tunnel with `cloudflared`, then start Casino Warehouse with `PUBLIC_BASE_URL=https://your-hostname.example npm run dev:server` so room invites and WebSocket origins match the published hostname.

Public tunnel sessions use three separate trust checks. WebSocket upgrades require an `Origin` header from a local development origin or from the configured public base URL; the integrated tunnel flows configure that base URL from the printed app URL. The localtunnel flow serves the app with a trusted runtime WebSocket URL for its separate WebSocket tunnel. If you expose the server through another public tunnel, set `PUBLIC_BASE_URL` to that app URL before starting `npm run dev:server`; set `PUBLIC_WEBSOCKET_URL` only when the browser should connect to a different public `ws://` or `wss://` URL. There is no development bypass for missing or unexpected WebSocket origins.

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
- If multiplayer devices cannot join each other, create a fresh room after both devices open the same local, ngrok, localtunnel, or Cloudflare Tunnel URL.
- If dependencies fail to install, confirm your Node version matches the requirement above.
- Development tools may emit Node 26 warnings from upstream packages, including `DEP0205` for `module.register()`, Vitest's localStorage warning, or color-environment warnings from Playwright web-server output. These are non-blocking toolchain warnings when the documented checks pass.

## Project Wiki

Architecture notes, protocol details, asset provenance, quality gates, and contributor-facing documentation live in the GitHub Wiki:

https://github.com/LMLiam/Casino-Warehouse/wiki

## License

Casino Warehouse is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use is not permitted, even though the repository is public.
