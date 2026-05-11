import { spawn } from 'node:child_process';
import ngrok from '@ngrok/ngrok';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const ngrokAddr = process.env.NGROK_ADDR ?? `127.0.0.1:${port}`;
const children = [];
let tunnel;

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

let shuttingDown = false;
const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    child.kill('SIGTERM');
  }
  void closeTunnel().finally(() => {
    process.exitCode = code;
  });
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const closeTunnel = async () => {
  if (!tunnel) {
    return;
  }
  const currentTunnel = tunnel;
  tunnel = undefined;
  await currentTunnel.close();
};

const startTunnel = async () => {
  const config = {
    addr: ngrokAddr,
    authtoken_from_env: true,
    metadata: 'beat-the-house-improved dev:public',
  };
  if (process.env.NGROK_DOMAIN) {
    config.domain = process.env.NGROK_DOMAIN;
  }
  tunnel = await ngrok.forward(config);
  const publicUrl = tunnel.url();
  if (!publicUrl?.startsWith('https://')) {
    throw new Error('ngrok started but did not return an HTTPS URL.');
  }
  return publicUrl;
};

try {
  console.log('Building Casino Warehouse client and multiplayer server...');
  await run('npm', ['run', 'build']);
  await run('npm', ['run', 'build:server']);

  console.log(`Starting integrated ngrok tunnel for ${ngrokAddr}...`);
  const publicUrl = await startTunnel();
  const wsUrl = publicUrl.replace(/^https:/, 'wss:') + '/ws';

  console.log('');
  console.log('Casino Warehouse public multiplayer is ready:');
  console.log(`  App URL: ${publicUrl}`);
  console.log(`  WebSocket URL: ${wsUrl}`);
  console.log('Share the App URL with another desktop/tablet device, then host or join a room in the Multiplayer Room panel.');
  console.log('The tunnel is managed by the @ngrok/ngrok npm package and will close when this script stops.');
  console.log('Warning: ngrok exposes this local development server publicly until you stop this script.');
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
  console.error('Set NGROK_AUTHTOKEN in your environment before running this script. Optional: set NGROK_DOMAIN for a reserved domain.');
  shutdown(1);
}
