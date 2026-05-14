import { spawn } from 'node:child_process';
import localtunnel from 'localtunnel';
import { WebSocket } from 'ws';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const localHost = process.env.LOCALTUNNEL_LOCAL_HOST ?? '127.0.0.1';
const localtunnelHost = process.env.LOCALTUNNEL_HOST ?? 'https://localtunnel.me';
const requestedSubdomain = process.env.LOCALTUNNEL_SUBDOMAIN?.trim();
const generatedSubdomain = `casino-${Math.random().toString(36).slice(2, 10)}`;
const requestedAppSubdomain = process.env.LOCALTUNNEL_APP_SUBDOMAIN?.trim() || requestedSubdomain || generatedSubdomain;
const requestedWebSocketSubdomain = process.env.LOCALTUNNEL_WS_SUBDOMAIN?.trim() || `${requestedAppSubdomain}-ws`;
const healthCheckTimeoutMs = Number(process.env.LOCALTUNNEL_HEALTH_TIMEOUT_MS ?? 5000);
const startupAttempts = Number(process.env.LOCALTUNNEL_STARTUP_ATTEMPTS ?? 5);
let server;
const tunnels = [];
const closingTunnels = new WeakSet();
let publicUrl = '';
let publicWebSocketUrl = '';
let shuttingDown = false;

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false, ...options });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? 'unknown status'}`));
      }
    });
    child.on('error', reject);
  });

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  closeTunnel();
  closeServer();
  process.exitCode = code;
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const closeTunnel = () => {
  while (tunnels.length > 0) {
    const tunnel = tunnels.pop();
    if (tunnel) {
      closingTunnels.add(tunnel);
      tunnel.close();
    }
  }
};

const closeServer = () => {
  const currentServer = server;
  server = undefined;
  currentServer?.close();
};

const startServer = async () => {
  const { createCasinoServer } = await import('../dist-server/serverEntry.js');
  server = createCasinoServer({
    publicBaseUrl: () => publicUrl,
    publicWebSocketUrl: () => publicWebSocketUrl,
  });
  server.on('error', (error) => {
    if (!shuttingDown) {
      console.error(error instanceof Error ? error.message : String(error));
      shutdown(1);
    }
  });
  server.on('close', () => {
    if (!shuttingDown) {
      console.error('Casino Warehouse server closed unexpectedly.');
      shutdown(1);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server?.off('error', reject);
      resolve();
    });
  });
};

const startTunnel = async (label, subdomain) => {
  const options = {
    port,
    host: localtunnelHost,
    local_host: localHost,
  };
  if (subdomain) {
    options.subdomain = subdomain;
  }

  const tunnel = await localtunnel(options);
  tunnels.push(tunnel);
  const publicUrl = normalizePublicUrl(tunnel.url);
  tunnel.on('error', (error) => {
    if (!shuttingDown && !closingTunnels.has(tunnel)) {
      console.error(`localtunnel ${label} tunnel error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(
        'Stopping because existing browser clients cannot automatically learn replacement localtunnel URLs. Rerun npm run dev:localtunnel and reload clients to use the fresh printed URLs.',
      );
      shutdown(1);
    }
  });
  tunnel.on('close', () => {
    if (!shuttingDown && !closingTunnels.has(tunnel)) {
      console.error(`localtunnel ${label} tunnel closed unexpectedly.`);
      console.error(
        'Stopping because existing browser clients cannot automatically learn replacement localtunnel URLs. Rerun npm run dev:localtunnel and reload clients to use the fresh printed URLs.',
      );
      shutdown(1);
    }
  });
  return { publicUrl, tunnel };
};

const closeStartedTunnel = (tunnel) => {
  const index = tunnels.indexOf(tunnel);
  if (index >= 0) {
    tunnels.splice(index, 1);
  }
  closingTunnels.add(tunnel);
  tunnel.close();
};

const normalizePublicUrl = (url) => {
  if (!url?.startsWith('https://') && !url?.startsWith('http://')) {
    throw new Error(`localtunnel returned unsupported public URL: ${url ?? 'unknown'}`);
  }
  return url.replace(/\/$/, '');
};

const websocketUrl = (publicUrl) => `${publicUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/ws`;

const checkPublicHealth = async (publicUrl) => {
  const timeout = Number.isFinite(healthCheckTimeoutMs) && healthCheckTimeoutMs > 0 ? healthCheckTimeoutMs : 5000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(new URL('/health', publicUrl), {
      headers: { 'bypass-tunnel-reminder': 'true' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return `HTTP ${response.status} ${response.statusText || 'response'}`;
    }
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timeoutId);
  }
};

const checkPublicWebSocket = (url, origin) =>
  new Promise((resolve) => {
    const timeout = Number.isFinite(healthCheckTimeoutMs) && healthCheckTimeoutMs > 0 ? healthCheckTimeoutMs : 5000;
    let settled = false;
    const websocket = new WebSocket(url, { headers: { Origin: origin } });
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        websocket.close();
        resolve(`timed out opening ${url}`);
      }
    }, timeout);

    websocket.on('open', () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      websocket.close();
      resolve(undefined);
    });
    websocket.on('error', () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve(`failed to open ${url} from ${origin}`);
    });
  });

const startHealthyTunnel = async (label, subdomain, options = {}) => {
  const attempts = Number.isFinite(startupAttempts) && startupAttempts > 0 ? Math.floor(startupAttempts) : 5;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let started;
    try {
      started = await startTunnel(label, subdomain);
      const healthError = await checkPublicHealth(started.publicUrl);
      const webSocketError =
        !healthError && options.webSocketOrigin ? await checkPublicWebSocket(websocketUrl(started.publicUrl), options.webSocketOrigin) : undefined;
      if (!healthError && !webSocketError) {
        if (attempt > 1) {
          console.log(`localtunnel ${label} tunnel succeeded on attempt ${attempt}.`);
        }
        return started.publicUrl;
      }
      lastError = healthError ?? webSocketError;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (started) {
      closeStartedTunnel(started.tunnel);
    }
    console.warn(`localtunnel ${label} tunnel attempt ${attempt}/${attempts} failed: ${lastError}`);
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`localtunnel ${label} tunnel did not pass startup probes: ${lastError ?? 'unknown failure'}`);
};

const warnIfPublicHealthFails = async (label, publicUrl) => {
  const healthError = await checkPublicHealth(publicUrl);
  if (!healthError) {
    return;
  }
  console.warn(`localtunnel warning: ${label} public health check failed for ${publicUrl}/health: ${healthError}`);
  console.warn(
    'The local server is running, but the public localtunnel service may be rate-limited, congested, or out of forwarding sockets. Try again, use npm run dev:ngrok, or set LOCALTUNNEL_HOST for a compatible self-hosted localtunnel server.',
  );
};

try {
  console.log('Building Casino Warehouse client and multiplayer server...');
  await run('npm', ['run', 'build']);
  await run('npm', ['run', 'build:server']);

  console.log(`Starting Casino Warehouse server on http://${host}:${port}...`);
  await startServer();

  console.log(`Starting integrated localtunnel app tunnel for ${localHost}:${port} through ${localtunnelHost}...`);
  publicUrl = await startHealthyTunnel('app', requestedAppSubdomain);
  publicWebSocketUrl = websocketUrl(publicUrl);

  console.log(`Starting integrated localtunnel WebSocket tunnel for ${localHost}:${port} through ${localtunnelHost}...`);
  const publicWebSocketBaseUrl = await startHealthyTunnel('websocket', requestedWebSocketSubdomain, { webSocketOrigin: publicUrl });
  publicWebSocketUrl = websocketUrl(publicWebSocketBaseUrl);

  await warnIfPublicHealthFails('app', publicUrl);
  await warnIfPublicHealthFails('websocket', publicWebSocketBaseUrl);

  console.log('');
  console.log('Casino Warehouse public multiplayer is ready:');
  console.log(`  App URL: ${publicUrl}`);
  console.log(`  WebSocket URL: ${publicWebSocketUrl}`);
  console.log('Share the App URL with another desktop/tablet device, then host or join a room in the Multiplayer Room panel.');
  console.log('Separate app and WebSocket tunnels are managed by the localtunnel npm package and will close when this script stops.');
  console.log('Warning: localtunnel exposes this local development server publicly until you stop this script.');
  console.log('');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    'Check network access to localtunnel.me, or set LOCALTUNNEL_HOST for a compatible self-hosted localtunnel server. Optional: LOCALTUNNEL_SUBDOMAIN requests an app name, LOCALTUNNEL_APP_SUBDOMAIN requests the app tunnel name, and LOCALTUNNEL_WS_SUBDOMAIN requests the WebSocket tunnel name, but the public service may assign different URLs.',
  );
  shutdown(1);
}
