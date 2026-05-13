import { spawn } from 'node:child_process';
import localtunnel from 'localtunnel';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const localHost = process.env.LOCALTUNNEL_LOCAL_HOST ?? '127.0.0.1';
const localtunnelHost = process.env.LOCALTUNNEL_HOST ?? 'https://localtunnel.me';
const requestedSubdomain = process.env.LOCALTUNNEL_SUBDOMAIN?.trim();
const healthCheckTimeoutMs = Number(process.env.LOCALTUNNEL_HEALTH_TIMEOUT_MS ?? 5000);
let server;
let tunnel;
let publicUrl = '';
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
  const currentTunnel = tunnel;
  tunnel = undefined;
  currentTunnel?.close();
};

const closeServer = () => {
  const currentServer = server;
  server = undefined;
  currentServer?.close();
};

const startServer = async () => {
  const { createCasinoServer } = await import('../dist-server/serverEntry.js');
  server = createCasinoServer({ publicBaseUrl: () => publicUrl });
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

const startTunnel = async () => {
  const options = {
    port,
    host: localtunnelHost,
    local_host: localHost,
  };
  if (requestedSubdomain) {
    options.subdomain = requestedSubdomain;
  }

  tunnel = await localtunnel(options);
  const publicUrl = normalizePublicUrl(tunnel.url);
  tunnel.on('error', (error) => {
    if (!shuttingDown) {
      console.error(`localtunnel warning: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  tunnel.on('close', () => {
    if (!shuttingDown) {
      console.error('localtunnel closed unexpectedly.');
      shutdown(1);
    }
  });
  return publicUrl;
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

const warnIfPublicHealthFails = async (publicUrl) => {
  const healthError = await checkPublicHealth(publicUrl);
  if (!healthError) {
    return;
  }
  console.warn(`localtunnel warning: public health check failed for ${publicUrl}/health: ${healthError}`);
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

  console.log(`Starting integrated localtunnel for ${localHost}:${port} through ${localtunnelHost}...`);
  publicUrl = await startTunnel();
  const wsUrl = websocketUrl(publicUrl);
  await warnIfPublicHealthFails(publicUrl);

  console.log('');
  console.log('Casino Warehouse public multiplayer is ready:');
  console.log(`  App URL: ${publicUrl}`);
  console.log(`  WebSocket URL: ${wsUrl}`);
  console.log('Share the App URL with another desktop/tablet device, then host or join a room in the Multiplayer Room panel.');
  console.log('The tunnel is managed by the localtunnel npm package and will close when this script stops.');
  console.log('Warning: localtunnel exposes this local development server publicly until you stop this script.');
  console.log('');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    'Check network access to localtunnel.me, or set LOCALTUNNEL_HOST for a compatible self-hosted localtunnel server. Optional: LOCALTUNNEL_SUBDOMAIN requests a name, but the public service may assign a different URL.',
  );
  shutdown(1);
}
