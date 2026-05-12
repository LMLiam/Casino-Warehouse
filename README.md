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
- Node.js 22.x (`22.12.0` or newer). Use `nvm use` or your version manager's equivalent to read the pinned version from `.nvmrc` or `.node-version`.
- npm
- A desktop or tablet browser

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

## Play on Another Device

To share a temporary public URL for another desktop or tablet, use the integrated ngrok flow:

```bash
export NGROK_AUTHTOKEN=YOUR_TOKEN
npm run dev:public
```

Share the printed app URL with the other device. The public tunnel stays open only while the command is running.

ngrok exposes your local development server to the internet while it is running. Use it only for trusted demo sessions.

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
- If multiplayer devices cannot join each other, create a fresh room after both devices open the same local or ngrok URL.
- If dependencies fail to install, confirm your Node version matches the requirement above.

## Project Wiki

Architecture notes, protocol details, asset provenance, quality gates, and contributor-facing documentation live in the GitHub Wiki:

https://github.com/LMLiam/Casino-Warehouse/wiki

## License

Casino Warehouse is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use is not permitted, even though the repository is public.
