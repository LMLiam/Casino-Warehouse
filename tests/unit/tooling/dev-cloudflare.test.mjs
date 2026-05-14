import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import {
  cloudflaredInstallDocsUrl,
  createCloudflarePublicTunnelLauncher,
  parseCloudflaredQuickTunnelUrl,
  publicWebSocketUrl,
} from '../../../scripts/dev-cloudflare.mjs';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killedSignals = [];

  constructor(command, args, options) {
    super();
    this.command = command;
    this.args = args;
    this.options = options;
  }

  kill(signal) {
    this.killedSignals.push(signal);
    return true;
  }

  writeStdout(output) {
    this.stdout.emit('data', Buffer.from(output));
  }

  writeStderr(output) {
    this.stderr.emit('data', Buffer.from(output));
  }
}

const createHarness = (options = {}) => {
  const logs = [];
  const errors = [];
  const spawned = [];
  const processApi = { on: vi.fn(), exitCode: undefined };
  const runCommand =
    options.runCommand ??
    vi.fn(async (command, args) => {
      logs.push(`run:${command} ${args.join(' ')}`);
    });
  const spawnProcess = vi.fn((command, args, spawnOptions) => {
    const child = new FakeChild(command, args, spawnOptions);
    spawned.push(child);
    return child;
  });
  const launcher = createCloudflarePublicTunnelLauncher({
    env: { PORT: '9001', HOST: '127.0.0.1', ...options.env },
    logger: {
      error: (message) => errors.push(message),
      log: (message) => logs.push(message),
    },
    processApi,
    runCommand,
    spawnProcess,
    tunnelUrlTimeoutMs: options.tunnelUrlTimeoutMs ?? 1000,
  });

  return { errors, launcher, logs, processApi, runCommand, spawned, spawnProcess };
};

const flushLauncherStartup = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('parseCloudflaredQuickTunnelUrl', () => {
  it('extracts the quick tunnel HTTPS origin from cloudflared output', () => {
    expect(
      parseCloudflaredQuickTunnelUrl(`
INF Requesting new quick Tunnel on trycloudflare.com...
INF +--------------------------------------------------------------------------------------------+
INF |  Your quick Tunnel has been created! Visit it at: https://casino-demo.trycloudflare.com     |
INF +--------------------------------------------------------------------------------------------+
`),
    ).toBe('https://casino-demo.trycloudflare.com');
  });

  it('rejects non-Cloudflare or non-HTTPS tunnel output', () => {
    expect(parseCloudflaredQuickTunnelUrl('https://casino.example.test')).toBeUndefined();
    expect(parseCloudflaredQuickTunnelUrl('http://casino-demo.trycloudflare.com')).toBeUndefined();
  });
});

describe('publicWebSocketUrl', () => {
  it('derives the websocket endpoint from the public app URL', () => {
    expect(publicWebSocketUrl('https://casino-demo.trycloudflare.com')).toBe('wss://casino-demo.trycloudflare.com/ws');
  });
});

describe('createCloudflarePublicTunnelLauncher', () => {
  it('starts cloudflared and launches the server with PUBLIC_BASE_URL from the quick tunnel URL', async () => {
    const harness = createHarness();
    const launched = harness.launcher.run();
    await flushLauncherStartup();

    expect(harness.runCommand).toHaveBeenNthCalledWith(1, 'cloudflared', ['--version'], { stdio: 'ignore' });
    expect(harness.runCommand).toHaveBeenNthCalledWith(2, 'npm', ['run', 'build']);
    expect(harness.runCommand).toHaveBeenNthCalledWith(3, 'npm', ['run', 'build:server']);
    expect(harness.spawned[0].command).toBe('cloudflared');
    expect(harness.spawned[0].args).toEqual(['tunnel', '--url', 'http://127.0.0.1:9001']);

    harness.spawned[0].writeStderr('INF Visit it at https://casino-demo.trycloudflare.com');
    await launched;

    const server = harness.spawned[1];
    expect(server.command).toBe('node');
    expect(server.args).toEqual(['dist-server/serverEntry.js']);
    expect(server.options.env.PUBLIC_BASE_URL).toBe('https://casino-demo.trycloudflare.com');
    expect(server.options.env.PORT).toBe('9001');
    expect(server.options.env.HOST).toBe('127.0.0.1');
    expect(harness.logs).toContain('  App URL: https://casino-demo.trycloudflare.com');
    expect(harness.logs).toContain('  WebSocket URL: wss://casino-demo.trycloudflare.com/ws');
    expect(harness.logs).toContain('  Local server URL: http://127.0.0.1:9001');
  });

  it('stops the server when the Cloudflare tunnel exits after startup', async () => {
    const harness = createHarness();
    const launched = harness.launcher.run();
    await flushLauncherStartup();
    harness.spawned[0].writeStdout('https://casino-demo.trycloudflare.com');
    await launched;

    harness.spawned[0].emit('exit', 1);

    expect(harness.processApi.exitCode).toBe(1);
    expect(harness.spawned[1].killedSignals).toEqual(['SIGTERM']);
    expect(harness.errors).toEqual(['cloudflared tunnel exited with 1. Stopping the local server.']);
  });

  it('stops the server when the Cloudflare tunnel closes cleanly after startup', async () => {
    const harness = createHarness();
    const launched = harness.launcher.run();
    await flushLauncherStartup();
    harness.spawned[0].writeStdout('https://casino-demo.trycloudflare.com');
    await launched;

    harness.spawned[0].emit('exit', 0);

    expect(harness.processApi.exitCode).toBe(0);
    expect(harness.spawned[1].killedSignals).toEqual(['SIGTERM']);
    expect(harness.logs).toContain('cloudflared tunnel exited. Stopping the local server.');
  });

  it('stops cloudflared when the server exits after startup', async () => {
    const harness = createHarness();
    const launched = harness.launcher.run();
    await flushLauncherStartup();
    harness.spawned[0].writeStdout('https://casino-demo.trycloudflare.com');
    await launched;

    harness.spawned[1].emit('exit', 1);

    expect(harness.processApi.exitCode).toBe(1);
    expect(harness.spawned[0].killedSignals).toEqual(['SIGTERM']);
    expect(harness.errors).toEqual(['Casino Warehouse server exited with 1. Stopping the Cloudflare tunnel.']);
  });

  it('stops cloudflared when the server closes cleanly after startup', async () => {
    const harness = createHarness();
    const launched = harness.launcher.run();
    await flushLauncherStartup();
    harness.spawned[0].writeStdout('https://casino-demo.trycloudflare.com');
    await launched;

    harness.spawned[1].emit('exit', 0);

    expect(harness.processApi.exitCode).toBe(0);
    expect(harness.spawned[0].killedSignals).toEqual(['SIGTERM']);
    expect(harness.logs).toContain('Casino Warehouse server exited. Stopping the Cloudflare tunnel.');
  });

  it('reports a missing cloudflared prerequisite before starting children', async () => {
    const runCommand = vi.fn(async (command) => {
      if (command === 'cloudflared') {
        throw Object.assign(new Error('spawn cloudflared ENOENT'), { code: 'ENOENT' });
      }
    });
    const harness = createHarness({ runCommand });

    await expect(harness.launcher.run()).rejects.toThrow(
      `cloudflared was not found. Install it before running npm run dev:cloudflare: ${cloudflaredInstallDocsUrl}`,
    );
    expect(harness.spawnProcess).not.toHaveBeenCalled();
  });

  it('fails safely instead of starting the server when cloudflared output has no public URL', async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness({ tunnelUrlTimeoutMs: 5 });
      const launched = harness.launcher.run();
      await flushLauncherStartup();
      harness.spawned[0].writeStderr('INF tunnel connected without a printable URL');
      const rejection = expect(launched).rejects.toThrow('cloudflared did not emit a trycloudflare.com HTTPS URL within 5ms.');

      await vi.advanceTimersByTimeAsync(5);

      await rejection;
      expect(harness.spawned[0].killedSignals).toEqual(['SIGTERM']);
      expect(harness.spawned).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails safely when cloudflared exits before printing a public URL', async () => {
    const harness = createHarness();
    const launched = harness.launcher.run();
    await flushLauncherStartup();
    const rejection = expect(launched).rejects.toThrow('cloudflared exited before emitting a public URL: 1');

    harness.spawned[0].emit('exit', 1);

    await rejection;
    expect(harness.spawned).toHaveLength(1);
  });
});
