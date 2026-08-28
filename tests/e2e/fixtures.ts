import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { AddressInfo } from 'node:net';
import { createCasinoServer, type CasinoServer } from '../../src/multiplayer/serverEntry';
import { createMemoryServerDataStore } from '../../src/state/serverDataStore/createMemoryServerDataStore';

type WorkerFixtures = {
  readonly realtimeUrl: string;
};

type TestFixtures = {
  readonly installRealtimeUrl: void;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  realtimeUrl: [
    async ({ browserName: _browserName }, use) => {
      const server = createCasinoServer({ adminToken: e2eAdminToken, dataStore: createMemoryServerDataStore(), heartbeatTimeoutMs: 300_000 });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address() as AddressInfo;
      try {
        await use(`ws://127.0.0.1:${address.port}/ws`);
      } finally {
        await closeServer(server);
      }
    },
    { scope: 'worker' },
  ],
  installRealtimeUrl: [
    async ({ context, realtimeUrl }, use) => {
      await context.addInitScript(
        ({ key, token, url }) => {
          if (!localStorage.getItem('casino_realtime_url')) {
            localStorage.setItem('casino_realtime_url', url);
          }
          localStorage.setItem(key, token);
        },
        { key: adminTokenStorageKey, token: e2eAdminToken, url: realtimeUrl },
      );
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Locator, Page };

export const e2eAdminToken = 'casino-e2e-admin-token';
const adminTokenStorageKey = 'casino_warehouse_admin_token';

export const resetBrowserStorage = async (page: Page, realtimeUrl: string): Promise<void> => {
  await page.evaluate(
    ({ key, token, url }) => {
      localStorage.clear();
      localStorage.setItem('casino_realtime_url', url);
      localStorage.setItem(key, token);
    },
    { key: adminTokenStorageKey, token: e2eAdminToken, url: realtimeUrl },
  );
};

export const currentRealtimeUrl = async (page: Page): Promise<string> =>
  page.evaluate(() => localStorage.getItem('casino_realtime_url') ?? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);

const closeServer = async (server: CasinoServer): Promise<void> => {
  server.closePeers();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
};
