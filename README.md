# Casino Warehouse

[![Project Checks](https://github.com/LMLiam/Casino-Warehouse/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LMLiam/Casino-Warehouse/actions/workflows/ci.yml?query=branch%3Amain)
[![CodeQL](https://github.com/LMLiam/Casino-Warehouse/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/LMLiam/Casino-Warehouse/actions/workflows/codeql.yml?query=branch%3Amain)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/LMLiam/Casino-Warehouse/badge)](https://scorecard.dev/viewer/?uri=github.com/LMLiam/Casino-Warehouse)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE)
[![Node 26.x](https://img.shields.io/badge/node-26.x-43853d?logo=node.js&logoColor=white)](#requirements)

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

Use an integrated public tunnel to share a temporary URL with another desktop
or tablet:

```bash
npm run dev:localtunnel
```

You can also use ngrok or a Cloudflare quick tunnel:

```bash
NGROK_AUTHTOKEN=YOUR_TOKEN npm run dev:ngrok
npm run dev:cloudflare
```

Each flow builds the app and server, prints an App URL and a WebSocket URL,
and closes its tunnel when the command stops. See
[Public tunnel demos](docs/public-tunnels.md) for provider requirements,
configuration, origin checks, and troubleshooting.

Public tunnel sessions are trusted demos. They expose the local development
server to the internet. Keep `CASINO_ADMIN_TOKEN` unset unless admin actions
are required, and never share it in an invite URL or broadcast message.

Server-created profiles use browser-local credentials. Another browser may see
a public profile but cannot act as that profile without its credential.

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
- `npm run dev` starts only the Vite client shell. Use it with a running server, or use `npm run dev:server` for the normal local app.
- If multiplayer devices cannot join each other, create a fresh room after both devices open the same tunnel URL.
- If dependencies fail to install, confirm your Node version matches the requirement above.

## Documentation

Read the [documentation index](docs/README.md) for architecture, code
quality, testing, public tunnels, assets, supply-chain security, CodeQL
Autofix, and Beat the House rules.

## License

Casino Warehouse is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use is not permitted, even though the repository is public.
