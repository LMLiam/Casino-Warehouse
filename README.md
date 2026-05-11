# Casino Warehouse

Casino Warehouse is a fictional-money casino arcade for desktop and tablet browsers. It includes Beat the House, Blackjack, and slots rooms with local multiplayer through a small Node server.

This is a demo game. Credits have no cash value, and the app has no deposits, withdrawals, payments, crypto, NFTs, or cash-out flow.

## Requirements

- Git
- Node.js `20.19.0` or newer, or `22.12.0` or newer
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

Casino Warehouse is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use is not permitted.
