import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalArgv = [...process.argv];
const originalHost = process.env.HOST;
const originalPort = process.env.PORT;

afterEach(() => {
  process.argv.length = 0;
  process.argv.push(...originalArgv);
  if (originalHost === undefined) {
    delete process.env.HOST;
  } else {
    process.env.HOST = originalHost;
  }
  if (originalPort === undefined) {
    delete process.env.PORT;
  } else {
    process.env.PORT = originalPort;
  }
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock('../../../src/multiplayer/serverEntry/createCasinoServer');
});

describe('maybeStartServer', () => {
  it('does not start the server when the module is imported or argv has no entrypoint', async () => {
    const { createCasinoServer, maybeStartServer } = await loadMaybeStartServer();
    const entryModuleUrl = pathToFileURL('/tmp/serverEntry.js').href;

    process.argv.length = 1;
    maybeStartServer(entryModuleUrl);
    process.argv[1] = '/tmp/other.js';
    maybeStartServer(entryModuleUrl);

    expect(createCasinoServer).not.toHaveBeenCalled();
  });

  it('starts the server for the entrypoint with configured host and port', async () => {
    const { createCasinoServer, listen, maybeStartServer } = await loadMaybeStartServer();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    process.argv[1] = '/tmp/serverEntry.js';
    process.env.HOST = '0.0.0.0';
    process.env.PORT = '9876';

    maybeStartServer(pathToFileURL('/tmp/serverEntry.js').href);

    expect(createCasinoServer).toHaveBeenCalledOnce();
    expect(listen).toHaveBeenCalledWith(9876, '0.0.0.0', expect.any(Function));
    expect(log).toHaveBeenCalledWith('Casino Warehouse server listening on http://0.0.0.0:9876');
    expect(log).toHaveBeenCalledWith('Expose this port with a public tunnel for tablet multiplayer testing.');
  });

  it('uses the documented local defaults when no host or port is configured', async () => {
    const { listen, maybeStartServer } = await loadMaybeStartServer();

    delete process.env.HOST;
    delete process.env.PORT;
    process.argv[1] = '/tmp/serverEntry.js';

    maybeStartServer(pathToFileURL('/tmp/serverEntry.js').href);

    expect(listen).toHaveBeenCalledWith(8787, '127.0.0.1', expect.any(Function));
  });
});

const loadMaybeStartServer = async () => {
  const listen = vi.fn((_port: number, _host: string, onListening: () => void) => {
    onListening();
  });
  const createCasinoServer = vi.fn(() => ({ listen }));
  vi.doMock('../../../src/multiplayer/serverEntry/createCasinoServer', () => ({ createCasinoServer }));
  const { maybeStartServer } = await import('../../../src/multiplayer/serverEntry/maybeStartServer');

  return { createCasinoServer, listen, maybeStartServer };
};
