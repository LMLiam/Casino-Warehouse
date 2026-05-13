import { spawn } from 'node:child_process';
import localtunnel from 'localtunnel';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const localHost = process.env.LOCALTUNNEL_LOCAL_HOST ?? '127.0.0.1';
const localtunnelHost = process.env.LOCALTUNNEL_HOST ?? 'https://localtunnel.me';
const requestedSubdomain = process.env.LOCALTUNNEL_SUBDOMAIN?.trim();
const children = [];
let tunnel;
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

const start = (command, args, options = {}) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: false, ...options });
  children.push(child);
  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`${command} ${args.join(' ')} exited with ${code ?? 'unknown status'}`);
      shutdown(1);
    }
  });
  child.on('error', (error) => {
    console.error(error.message);
    shutdown(1);
  });
  return child;
};

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    child.kill('SIGTERM');
  }
  closeTunnel();
  process.exitCode = code;
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const closeTunnel = () => {
  const currentTunnel = tunnel;
  tunnel = undefined;
  currentTunnel?.close();
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

try {
  console.log('Building Casino Warehouse client and multiplayer server...');
  await run('npm', ['run', 'build']);
  await run('npm', ['run', 'build:server']);

  console.log(`Starting integrated localtunnel for ${localHost}:${port} through ${localtunnelHost}...`);
  const publicUrl = await startTunnel();
  const wsUrl = websocketUrl(publicUrl);

  console.log('');
  console.log('Casino Warehouse public multiplayer is ready:');
  console.log(`  App URL: ${publicUrl}`);
  console.log(`  WebSocket URL: ${wsUrl}`);
  console.log('Share the App URL with another desktop/tablet device, then host or join a room in the Multiplayer Room panel.');
  console.log('The tunnel is managed by the localtunnel npm package and will close when this script stops.');
  console.log('Warning: localtunnel exposes this local development server publicly until you stop this script.');
  console.log('');

  start('node', ['dist-server/serverEntry.js'], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      PUBLIC_BASE_URL: publicUrl,
    },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    'Check network access to localtunnel.me, or set LOCALTUNNEL_HOST for a compatible self-hosted localtunnel server. Optional: LOCALTUNNEL_SUBDOMAIN requests a name, but the public service may assign a different URL.',
  );
  shutdown(1);
}
