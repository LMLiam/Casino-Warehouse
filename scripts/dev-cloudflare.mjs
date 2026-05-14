import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const cloudflaredInstallDocsUrl = 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/';
export const defaultTunnelUrlTimeoutMs = 30_000;

export const parseCloudflaredQuickTunnelUrl = (output) => {
  const matches = output.match(/https:\/\/[a-z0-9][a-z0-9.-]*\.trycloudflare\.com(?=[\s"'<>)]|$)/giu) ?? [];
  for (const match of matches) {
    try {
      const url = new URL(match);
      if (url.protocol === 'https:' && url.hostname.endsWith('.trycloudflare.com')) {
        return url.origin;
      }
    } catch {
      // Ignore malformed URL-like output and keep scanning for a valid quick tunnel URL.
    }
  }
  return undefined;
};

export const publicWebSocketUrl = (publicUrl) => `${publicUrl.replace(/^https:/u, 'wss:').replace(/^http:/u, 'ws:')}/ws`;

export const createCloudflarePublicTunnelLauncher = ({
  env = process.env,
  logger = console,
  processApi = process,
  runCommand,
  spawnProcess = spawn,
  tunnelUrlTimeoutMs = Number(env.CLOUDFLARE_TUNNEL_URL_TIMEOUT_MS ?? defaultTunnelUrlTimeoutMs),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) => {
  const port = Number(env.PORT ?? 8787);
  const host = env.HOST ?? '0.0.0.0';
  const localTunnelUrl = env.CLOUDFLARE_TUNNEL_LOCAL_URL ?? `http://127.0.0.1:${port}`;
  const children = new Set();
  let shuttingDown = false;

  const trackedRunCommand =
    runCommand ??
    ((command, args, options = {}) =>
      new Promise((resolve, reject) => {
        const child = spawnProcess(command, args, { stdio: 'inherit', shell: false, ...options });
        children.add(child);
        child.on('exit', (code) => {
          children.delete(child);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? 'unknown status'}`));
          }
        });
        child.on('error', (error) => {
          children.delete(child);
          reject(error);
        });
      }));

  const shutdown = (code = 0) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    for (const child of children) {
      child.kill('SIGTERM');
    }
    processApi.exitCode = code;
  };

  processApi.on?.('SIGINT', () => shutdown(0));
  processApi.on?.('SIGTERM', () => shutdown(0));

  const ensureCloudflaredInstalled = async () => {
    try {
      await trackedRunCommand('cloudflared', ['--version'], { stdio: 'ignore' });
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(`cloudflared was not found. Install it before running npm run dev:cloudflare: ${cloudflaredInstallDocsUrl}`, {
          cause: error,
        });
      }
      throw new Error(`cloudflared is required but failed its version check: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  };

  const startCloudflaredTunnel = () =>
    new Promise((resolve, reject) => {
      const timeout = Number.isFinite(tunnelUrlTimeoutMs) && tunnelUrlTimeoutMs > 0 ? tunnelUrlTimeoutMs : defaultTunnelUrlTimeoutMs;
      const cloudflared = spawnProcess('cloudflared', ['tunnel', '--url', localTunnelUrl], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      children.add(cloudflared);
      let settled = false;
      let output = '';
      let timeoutId;

      const rejectStartup = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeoutFn(timeoutId);
        children.delete(cloudflared);
        cloudflared.kill('SIGTERM');
        reject(error);
      };

      const resolveStartup = (publicUrl) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeoutFn(timeoutId);
        resolve(publicUrl);
      };

      timeoutId = setTimeoutFn(() => {
        rejectStartup(new Error(`cloudflared did not emit a trycloudflare.com HTTPS URL within ${timeout}ms.`));
      }, timeout);

      const inspectOutput = (chunk) => {
        output += chunk.toString();
        const publicUrl = parseCloudflaredQuickTunnelUrl(output);
        if (publicUrl) {
          resolveStartup(publicUrl);
        }
      };

      cloudflared.stdout?.on('data', inspectOutput);
      cloudflared.stderr?.on('data', inspectOutput);
      cloudflared.on('error', (error) => {
        if (!settled) {
          rejectStartup(error);
          return;
        }
        children.delete(cloudflared);
        if (!shuttingDown) {
          logger.error(error instanceof Error ? error.message : String(error));
          shutdown(1);
        }
      });
      cloudflared.on('exit', (code) => {
        children.delete(cloudflared);
        if (!settled) {
          rejectStartup(new Error(`cloudflared exited before emitting a public URL: ${code ?? 'unknown status'}`));
          return;
        }
        if (!shuttingDown) {
          if (code === 0) {
            logger.log('cloudflared tunnel exited. Stopping the local server.');
            shutdown(0);
          } else {
            logger.error(`cloudflared tunnel exited with ${code ?? 'unknown status'}. Stopping the local server.`);
            shutdown(1);
          }
        }
      });
    });

  const startServer = (publicUrl) => {
    const server = spawnProcess('node', ['dist-server/serverEntry.js'], {
      env: {
        ...env,
        HOST: host,
        PORT: String(port),
        PUBLIC_BASE_URL: publicUrl,
      },
      shell: false,
      stdio: 'inherit',
    });
    children.add(server);
    server.on('exit', (code) => {
      children.delete(server);
      if (!shuttingDown) {
        if (code === 0) {
          logger.log('Casino Warehouse server exited. Stopping the Cloudflare tunnel.');
          shutdown(0);
        } else {
          logger.error(`Casino Warehouse server exited with ${code ?? 'unknown status'}. Stopping the Cloudflare tunnel.`);
          shutdown(1);
        }
      }
    });
    server.on('error', (error) => {
      children.delete(server);
      if (!shuttingDown) {
        logger.error(`Casino Warehouse server failed to start: ${error instanceof Error ? error.message : String(error)}`);
        logger.error('Check that npm run build:server succeeds and that HOST/PORT are available.');
        shutdown(1);
      }
    });
    return server;
  };

  const run = async () => {
    await ensureCloudflaredInstalled();

    logger.log('Building Casino Warehouse client and multiplayer server...');
    await trackedRunCommand('npm', ['run', 'build']);
    await trackedRunCommand('npm', ['run', 'build:server']);

    logger.log(`Starting Cloudflare quick tunnel for ${localTunnelUrl}...`);
    const publicUrl = await startCloudflaredTunnel();
    const wsUrl = publicWebSocketUrl(publicUrl);

    logger.log('');
    logger.log('Casino Warehouse public multiplayer is ready:');
    logger.log(`  App URL: ${publicUrl}`);
    logger.log(`  WebSocket URL: ${wsUrl}`);
    logger.log(`  Local server URL: ${localTunnelUrl}`);
    logger.log('Share the App URL with another desktop/tablet device, then host or join a room in the Multiplayer Room panel.');
    logger.log('The quick tunnel is managed by the cloudflared binary and will close when this script stops.');
    logger.log('Warning: Cloudflare Tunnel exposes this local development server publicly until you stop this script.');
    logger.log('');

    startServer(publicUrl);
  };

  return { run, shutdown };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const launcher = createCloudflarePublicTunnelLauncher();
  try {
    await launcher.run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`Check the command output above. If cloudflared is missing or outdated, install or update it from ${cloudflaredInstallDocsUrl}.`);
    console.error('Quick tunnels also need outbound network access to Cloudflare.');
    launcher.shutdown(1);
  }
}
