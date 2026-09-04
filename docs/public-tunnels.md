# Public Tunnel Demos

Public tunnel scripts expose the local HTTP and WebSocket server for a trusted
desktop or tablet demo. They are development tools, not production hosting.
Stop the command when the demo ends.

## Provider Commands

| Command                   | Provider                   | Requirements                                                           | WebSocket setup                           |
| ------------------------- | -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| `npm run dev:ngrok`       | ngrok                      | `NGROK_AUTHTOKEN`                                                      | WebSocket URL is derived from the app URL |
| `npm run dev:localtunnel` | localtunnel                | Network access to `localtunnel.me`, or a compatible `LOCALTUNNEL_HOST` | Separate app and WebSocket tunnels        |
| `npm run dev:cloudflare`  | `cloudflared` quick tunnel | Installed `cloudflared` binary and outbound network access             | WebSocket URL is derived from the app URL |
| `npm run dev:cloudflared` | Alias for Cloudflare       | Same as `dev:cloudflare`                                               | Same as `dev:cloudflare`                  |
| `npm run dev:public`      | Alias for ngrok            | Same as `dev:ngrok`                                                    | Same as `dev:ngrok`                       |

Every provider flow builds the client and server, starts or connects the
realtime server, validates or discovers a public HTTPS URL, and prints an App
URL and a WebSocket URL. Share only the App URL. The browser uses the printed
runtime WebSocket URL for the realtime connection.

## ngrok

Set the authentication token before starting the integrated flow:

```bash
export NGROK_AUTHTOKEN=YOUR_TOKEN
npm run dev:ngrok
```

The script uses the `@ngrok/ngrok` package and forwards the local server at
`127.0.0.1:${PORT}`. `PORT` defaults to `8787`; `HOST` defaults to
`0.0.0.0`. Set `NGROK_ADDR` to override the forwarded address. Set
`NGROK_DOMAIN` when using a reserved ngrok domain.

The script sets `PUBLIC_BASE_URL` to the printed HTTPS app URL. It derives the
WebSocket URL by replacing `https:` with `wss:` and appending `/ws`.

## localtunnel

Start the flow with:

```bash
npm run dev:localtunnel
```

The script starts the server first, then opens an app tunnel and a separate
WebSocket tunnel. It probes `/health` and the WebSocket upgrade before it
prints the URLs. It retries startup up to five times by default.

Use these variables when the defaults do not fit the environment:

| Variable                        | Default                                   | Purpose                                   |
| ------------------------------- | ----------------------------------------- | ----------------------------------------- |
| `PORT`                          | `8787`                                    | Local server port                         |
| `HOST`                          | `0.0.0.0`                                 | Local server bind host                    |
| `LOCALTUNNEL_LOCAL_HOST`        | `127.0.0.1`                               | Host passed to localtunnel                |
| `LOCALTUNNEL_HOST`              | `https://localtunnel.me`                  | Public or self-hosted localtunnel service |
| `LOCALTUNNEL_SUBDOMAIN`         | Generated app name                        | Requested app tunnel name                 |
| `LOCALTUNNEL_APP_SUBDOMAIN`     | `LOCALTUNNEL_SUBDOMAIN` or generated name | Requested app tunnel name                 |
| `LOCALTUNNEL_WS_SUBDOMAIN`      | `<app-name>-ws`                           | Requested WebSocket tunnel name           |
| `LOCALTUNNEL_HEALTH_TIMEOUT_MS` | `5000`                                    | Health and WebSocket probe timeout        |
| `LOCALTUNNEL_STARTUP_ATTEMPTS`  | `5`                                       | Number of startup attempts                |

The public service may assign different names from requested subdomains. If a
tunnel closes or errors unexpectedly, the script stops because existing
browsers cannot learn replacement URLs. Rerun the command and reload every
client.

## Cloudflare Quick Tunnel

Install `cloudflared` from the
[Cloudflare downloads documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/), then run:

```bash
npm run dev:cloudflare
```

The script checks `cloudflared --version`, starts
`cloudflared tunnel --url http://127.0.0.1:<port>`, waits for an HTTPS
`*.trycloudflare.com` URL, builds the app and server, and starts the server
with `PUBLIC_BASE_URL` set to that URL. Set `CLOUDFLARE_TUNNEL_LOCAL_URL` to
forward a different local URL. Set
`CLOUDFLARE_TUNNEL_URL_TIMEOUT_MS` to change the 30-second URL wait.

Quick tunnels generate random hostnames. They have no uptime guarantee, have a
200 in-flight request limit, and do not support Server-Sent Events. Use a
named Cloudflare Tunnel and a stable hostname for recurring development. Set
`PUBLIC_BASE_URL=https://your-hostname.example` when starting the server for a
separately managed named tunnel.

## Manual Configuration

When another tunnel provider manages the process, start the normal server and
set the public app URL before the server starts:

```bash
PUBLIC_BASE_URL=https://app.example.test npm run dev:server
```

Set `PUBLIC_WEBSOCKET_URL` only when the browser must connect to a different
public WebSocket URL:

```bash
PUBLIC_BASE_URL=https://app.example.test \
PUBLIC_WEBSOCKET_URL=wss://ws.example.test/ws \
npm run dev:server
```

The WebSocket origin policy accepts local development origins and the
configured public base URL. There is no development bypass for a missing or
unexpected `Origin` header. Keep the public base URL aligned with the URL that
users open.

## Security

Public tunnels expose the local development server to the internet. Use only
fictional credits and trusted demo participants. Leave `CASINO_ADMIN_TOKEN`
unset unless admin actions are required. If it is set, share the token only
with trusted maintainers and never put it in an invite URL, log, room snapshot,
or browser broadcast.

Server-created profiles receive browser-local credentials. A different browser
may see a public profile but cannot rename, delete, save with, host as, or join
rooms as that profile without its credential.

## Smoke Test

Run the public-tunnel smoke test only against a live trusted URL:

```bash
PUBLIC_TUNNEL_SMOKE_URL=https://example.trycloudflare.com npm run visual -- --project=laptop tests/e2e/public-tunnel-smoke.spec.ts
```

`NGROK_SMOKE_URL` is retained as an ngrok-specific alias. Do not record a
provider URL or test result as permanent documentation. The URL changes when a
quick or hosted tunnel restarts.
