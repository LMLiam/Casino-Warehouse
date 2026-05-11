import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import type { AddressInfo } from 'node:net';
import { createCasinoServer, type CasinoServer } from '../../src/multiplayer/serverEntry';
import { createMemoryServerDataStore, type ServerDataStore } from '../../src/state/serverDataStore';
import { createSessionState } from '../../src/state/session';

let realtimeServer: CasinoServer | undefined;

test.beforeEach(({ context: _context }, testInfo) => {
  test.skip(testInfo.project.name !== 'laptop', 'The multi-browser scenarios create their own browser contexts.');
});

test.afterEach(async () => {
  await closeRealtimeServer();
});

test('multiplayer room lobby supports create, join, seat choice, spectate, leave, reconnect, and Blackjack table play', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const wsUrl = await startRealtimeServer(['Alice', 'Bob', 'Sue']);
  const contexts: BrowserContext[] = [];
  const openPlayer = async (name: string): Promise<Page> => {
    const context = await newPlayerContext(browser, wsUrl);
    contexts.push(context);
    return newPlayerPage(context, baseURL, name);
  };
  try {
    const host = await openPlayer('Alice');

    await host.locator('[data-lobby-game="blackjack"]').click();
    await expect(host.locator('#roomLobby')).toBeVisible();
    await expect(host.locator('#blackjackView')).toBeHidden();
    await host.locator('#roomNameInput').fill('Five Seat QA');
    await host.getByRole('button', { name: 'Create Room' }).click();
    await expect(host.locator('#blackjackView')).toBeVisible();
    await expect(host.locator('#blackjackView')).toHaveCSS('background-image', /assets\/blackjack\/table\.png/);
    await claimRoomSeat(host, 'Seat-1');

    const players = [host];
    const bob = await openPlayer('Bob');
    await bob.locator('[data-lobby-game="blackjack"]').click();
    await expect(bob.getByRole('button', { name: 'Join Room' }).first()).toBeEnabled();
    await bob.getByRole('button', { name: 'Join Room' }).first().click();
    await expect(bob.locator('#blackjackView')).toBeVisible();
    await expect(bob.locator('#blackjackDealBtn')).toBeHidden();
    await claimRoomSeat(bob, 'Seat-2');
    await expect(bob.locator('#blackjackDealBtn')).toBeVisible();
    players.push(bob);

    const spectator = await openPlayer('Sue');
    await spectator.locator('[data-lobby-game="blackjack"]').click();
    await spectator.getByRole('button', { name: 'Spectate' }).first().click();
    await expect(spectator.locator('#blackjackResult')).toContainText('Spectating this Blackjack table');

    await expect(host.locator('.blackjack-table-seat')).toHaveCount(5);
    await expect(host.locator('.blackjack-table-seat')).toContainText(['Alice', 'Bob']);

    await players[1].locator('#leaveRoomBtn').click();
    await expect(players[1].locator('#roomLobby')).toBeVisible();
    await expect(players[1].locator('#blackjackView')).toBeHidden();

    const reconnected = players[1];
    await reconnected.reload({ waitUntil: 'domcontentloaded' });
    await reconnected.waitForFunction(() => document.body.dataset.appReady === 'true');
    await waitForRealtime(reconnected);
    await expect(reconnected.locator('#gameLobby')).toBeVisible();
    await reconnected.locator('[data-lobby-game="blackjack"]').click();
    await reconnected.getByRole('button', { name: 'Refresh Rooms' }).click();
    await reconnected.getByRole('button', { name: 'Join Room' }).first().click();
    await expect(reconnected.locator('#blackjackView')).toBeVisible();
    await claimRoomSeat(reconnected, 'Seat-2');

    for (const [index, page] of players.entries()) {
      await page.locator('#blackjackWager').fill(String((index + 1) * 10));
      await page.locator('#blackjackDealBtn').click();
    }

    await expect(host.locator('.blackjack-table-seat')).toHaveCount(5);
    await expect(host.locator('.blackjack-table-seat').filter({ hasText: 'Wager £10' })).toBeVisible();
    await expect(host.locator('.blackjack-table-seat').filter({ hasText: 'Wager £20' })).toBeVisible();
    await expect(host.locator('.blackjack-table-seat .seat-cards .playing-card').first()).toBeVisible();
    await expect
      .poll(async () => (await host.locator('.blackjack-table-seat.active').count()) === 1 || (await host.locator('#blackjackNewBtn').isEnabled()), { timeout: 10_000 })
      .toBe(true);
  } finally {
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  }
});

test('reconnected Beat the House clients return home when a restarted server has no active room', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const dataStore = seedDataStore(['Restart Alice', 'Restart Bob']);
  const wsUrl = await startRealtimeServerWithStore(dataStore);
  const restartPort = Number(new URL(wsUrl).port);
  const aliceContext = await newPlayerContext(browser, wsUrl);
  const bobContext = await newPlayerContext(browser, wsUrl);
  try {
    const alice = await newPlayerPage(aliceContext, baseURL, 'Restart Alice');
    const bob = await newPlayerPage(bobContext, baseURL, 'Restart Bob');

    await alice.locator('[data-lobby-game="beat-the-house"]').click();
    await alice.locator('#roomNameInput').fill('Restarted Room');
    await alice.getByRole('button', { name: 'Create Room' }).click();
    await expect(alice.locator('#tableHost')).toBeVisible();
    await claimRoomSeat(alice, 'Left');

    await bob.locator('[data-lobby-game="beat-the-house"]').click();
    await bob.getByRole('button', { name: 'Join Room' }).first().click();
    await expect(bob.locator('#tableHost')).toBeVisible();
    await claimRoomSeat(bob, 'Centre');
    await expect(alice.locator('#roomSeats')).toContainText('Centre: Restart Bob', { timeout: 10_000 });

    await closeRealtimeServer();
    await expect(alice.locator('#connectionOverlay')).toBeVisible({ timeout: 10_000 });
    await expect(bob.locator('#connectionOverlay')).toBeVisible({ timeout: 10_000 });

    await startRealtimeServerWithStore(dataStore, restartPort);
    await waitForRealtime(alice);
    await waitForRealtime(bob);

    for (const page of [alice, bob]) {
      await expect(page.locator('#gameLobby')).toBeVisible();
      await expect(page.locator('#tableHost')).toBeHidden();
      await expect(page.locator('#roomLobby')).toBeHidden();
      await expect(page.locator('#nextBtn')).toBeHidden();
    }
  } finally {
    await aliceContext.close().catch(() => undefined);
    await bobContext.close().catch(() => undefined);
  }
});

test('new browsers do not inherit another saved profile session and can switch profiles', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const dataStore = seedDataStore(['Server Alice', 'Server Bob']);
  const aliceProfile = dataStore.snapshot().profileState.profiles.find((profile) => profile.name === 'Server Alice');
  if (!aliceProfile) {
    throw new Error('Expected seeded Alice profile.');
  }
  dataStore.saveSession(createSessionState([aliceProfile.id], { activeGame: 'blackjack', showingGameLobby: false }));
  const wsUrl = await startRealtimeServerWithStore(dataStore);
  const bobContext = await newPlayerContext(browser, wsUrl);
  try {
    const bob = await bobContext.newPage();
    await bob.goto(baseURL ?? '/', { waitUntil: 'domcontentloaded' });
    await bob.waitForFunction(() => document.body.dataset.appReady === 'true');
    await waitForRealtime(bob);

    await expect(bob.locator('#setup')).toBeVisible();
    await expect(bob.locator('#casinoShell')).toBeHidden();
    await expect(bob.locator('#profileList')).toContainText('Server Alice');
    await expect(bob.locator('#profileList')).toContainText('Server Bob');

    await startExistingProfileSession(bob, 'Server Bob');
    await expect(bob.locator('#gameLobby')).toBeVisible();
    await expect(bob.locator('#playerStrip')).toContainText('Server Bob');
    await expect(bob.locator('#playerStrip')).not.toContainText('Server Alice');

    await bob.getByRole('button', { name: 'Switch Profile' }).click();
    await expect(bob.locator('#setup')).toBeVisible();
    await expect(bob.locator('#casinoShell')).toBeHidden();

    await bob.reload({ waitUntil: 'domcontentloaded' });
    await bob.waitForFunction(() => document.body.dataset.appReady === 'true');
    await waitForRealtime(bob);
    await expect(bob.locator('#setup')).toBeVisible();
    await expect(bob.locator('#casinoShell')).toBeHidden();
  } finally {
    await bobContext.close().catch(() => undefined);
  }
});

test('reloaded Beat the House clients verify the saved room against the server and restore active state', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const wsUrl = await startRealtimeServer(['Restore Alice', 'Restore Bob']);
  const aliceContext = await newPlayerContext(browser, wsUrl);
  const bobContext = await newPlayerContext(browser, wsUrl);
  try {
    const alice = await newPlayerPage(aliceContext, baseURL, 'Restore Alice');
    const bob = await newPlayerPage(bobContext, baseURL, 'Restore Bob');

    await alice.locator('[data-lobby-game="beat-the-house"]').click();
    await alice.locator('#roomNameInput').fill('Restorable Room');
    await alice.getByRole('button', { name: 'Create Room' }).click();
    await expect(alice.locator('#tableHost')).toBeVisible();
    await claimRoomSeat(alice, 'Left');

    await bob.locator('[data-lobby-game="beat-the-house"]').click();
    await bob.getByRole('button', { name: 'Join Room' }).first().click();
    await expect(bob.locator('#tableHost')).toBeVisible();
    await claimRoomSeat(bob, 'Centre');
    await expect(alice.locator('#roomSeats')).toContainText('Centre: Restore Bob', { timeout: 10_000 });
    await expect(bob.locator('#roomSeats')).toContainText('Centre: Restore Bob');
    await expect(bob.locator('#chipRail')).toBeVisible();

    await bob.getByLabel('£25 chip').click();
    await expect(bob.getByLabel('£25 chip')).toHaveClass(/selected/);
    await dropChipPercent(bob, 50, 75.85, 25);
    await expect.poll(async () => (await parsedDataset(bob, 'activeMainBets')).includes('centre')).toBe(true);

    await alice.reload({ waitUntil: 'domcontentloaded' });
    await alice.waitForFunction(() => document.body.dataset.appReady === 'true');
    await waitForRealtime(alice);

    await expect(alice.locator('#tableHost')).toBeVisible();
    await expect(alice.locator('#roomSeats')).toContainText('Left: Restore Alice', { timeout: 10_000 });
    await expect(alice.locator('#roomSeats')).toContainText('Centre: Restore Bob');
    await expect.poll(async () => (await parsedDataset(alice, 'activeMainBets')).includes('centre')).toBe(true);
  } finally {
    await aliceContext.close().catch(() => undefined);
    await bobContext.close().catch(() => undefined);
  }
});

test('Beat the House table keeps per-hand popups, side-bet labels, deal order, and cleanup stable', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const wsUrl = await startRealtimeServer(['Beat QA']);
  const context = await newPlayerContext(browser, wsUrl);
  try {
    const page = await newPlayerPage(context, baseURL, 'Beat QA');
    await page.locator('[data-lobby-game="beat-the-house"]').click();
    await page.locator('#roomNameInput').fill('Popup QA');
    await page.getByRole('button', { name: 'Create Room' }).click();
    await expect(page.locator('#tableHost')).toBeVisible();
    await expect(page.locator('#tableHost canvas')).toBeVisible();
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.dealerCardCount)).toBe('0');
    await expect(page.locator('#chipRail')).toBeHidden();
    await claimRoomSeat(page, 'Left');
    await expect(page.locator('.seat-status-pill.mine')).toContainText('£1,000 (even)');
    await expect(page.locator('#chipRail')).toBeVisible();

    await page.getByLabel('£25 chip').click();
    await expect(page.getByLabel('£25 chip')).toHaveClass(/selected/);
    await dropChipPercent(page, 19.25, 70.55, 25);
    await expect(page.locator('.seat-status-pill.mine')).toContainText('£975 (-£25)');
    await expect.poll(async () => (await parsedDataset(page, 'activeMainBets')).includes('left')).toBe(true);
    await dropChipPercent(page, 29.7, 44.2, 25);
    await dropChipPercent(page, 30.4, 45.0, 25);
    await dropChipPercent(page, 28.9, 43.8, 25);
    await expect.poll(() => tableAmount(page)).toBeGreaterThan(25);
    await page.locator('#dealBtn').click();

    await expect
      .poll(() => parsedDataset(page, 'cardAnimationOrders'))
      .toEqual(
        expect.arrayContaining([
          ['player-left-0', 0],
          ['dealer-hole', 1],
        ]),
      );
    await expect.poll(async () => Number(await page.locator('#tableHost').evaluate((element) => element.dataset.dealerCardCount ?? '0'))).toBeGreaterThanOrEqual(1);

    const animationOrdersBeforePanel = await parsedDataset(page, 'cardAnimationOrders');
    await page.locator('.admin-panel > summary').click();
    await expect.poll(() => parsedDataset(page, 'cardAnimationOrders')).toEqual(animationOrdersBeforePanel);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (await page.locator('#nextBtn').isEnabled()) {
        break;
      }
      if (await page.locator('#stickBtn').isEnabled()) {
        await page.locator('#stickBtn').click();
      } else {
        await page.waitForTimeout(250);
      }
    }

    await expect(page.locator('#nextBtn')).toBeEnabled({ timeout: 10_000 });
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.settlementVisible), { timeout: 10_000 }).toBe('true');
    await expect.poll(async () => Number(await page.locator('#tableHost').evaluate((element) => element.dataset.settlementHandCount ?? '0'))).toBeGreaterThanOrEqual(1);
    await expect
      .poll(async () =>
        (await parsedDataset(page, 'settlementResults')).some(
          (result) => String(result).includes(':win:') || String(result).includes(':lose:') || String(result).includes(':push:'),
        ),
      )
      .toBe(true);
    await expect.poll(async () => (await parsedDataset(page, 'sideBetLabels')).some((label) => String(label).includes('Dealer Sevens'))).toBe(true);

    await page.locator('#layoutOverlayBtn').click();
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.settlementVisible)).toBe('true');

    await page.locator('#nextBtn').click();
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.settlementVisible)).toBe('false');
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.dealerCardCount)).toBe('0');
    await expect(page.locator('#chipRail')).toBeVisible();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await dropChipPercent(page, 19.25, 70.55, 25);
    await dropChipPercent(page, 29.7, 44.2, 25);
    await page.locator('#dealBtn').click();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (await page.locator('#nextBtn').isEnabled()) {
        break;
      }
      if (await page.locator('#stickBtn').isEnabled()) {
        await page.locator('#stickBtn').click();
      } else {
        await page.waitForTimeout(150);
      }
    }
    await expect(page.locator('#nextBtn')).toBeEnabled({ timeout: 10_000 });
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.settlementVisible)).toBe('true');
    await expect.poll(async () => (await parsedDataset(page, 'sideBetLabels')).some((label) => String(label).includes('Dealer Sevens'))).toBe(true);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test('multiplayer Slots exposes shared readiness, spin result, spectating, and no duplicate settlement from repeated spin attempts', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const wsUrl = await startRealtimeServer(['Slots Alice', 'Slots Bob', 'Slots Watcher']);
  const contexts: BrowserContext[] = [];
  const openPlayer = async (name: string): Promise<Page> => {
    const context = await newPlayerContext(browser, wsUrl);
    contexts.push(context);
    return newPlayerPage(context, baseURL, name);
  };
  try {
    const alice = await openPlayer('Slots Alice');
    await alice.locator('[data-lobby-game="slots:thai-princess"]').click();
    await alice.locator('#roomNameInput').fill('Shared Spin QA');
    await alice.getByRole('button', { name: 'Create Room' }).click();
    await expect(alice.locator('#slotsView')).toBeVisible();
    await expectSlotReelsUseSymbolImages(alice);
    await claimRoomSeat(alice, 'Seat-1');

    const bob = await openPlayer('Slots Bob');
    await bob.locator('[data-lobby-game="slots:thai-princess"]').click();
    await bob.getByRole('button', { name: 'Join Room' }).first().click();
    await expect(bob.locator('#slotsView')).toBeVisible();
    await claimRoomSeat(bob, 'Seat-2');

    const watcher = await openPlayer('Slots Watcher');
    await watcher.locator('[data-lobby-game="slots:thai-princess"]').click();
    await watcher.getByRole('button', { name: 'Spectate' }).first().click();
    await expect(watcher.locator('#slotsRoomPlayers')).toContainText('Slots Alice');

    await alice.locator('#slotsWager').fill('5');
    await alice.locator('#slotsWagerBtn').click();
    await bob.locator('#slotsWager').fill('10');
    await bob.locator('#slotsWagerBtn').click();
    await alice.locator('#slotsReadyBtn').click();
    await bob.locator('#slotsReadyBtn').click();

    await expect(alice.locator('#slotsRoomPlayers')).toContainText('Ready');
    await expect(bob.locator('#slotsRoomPlayers')).toContainText('Wager £10');
    await alice.locator('#slotsSpinBtn').click();
    await expect(alice.locator('#slotsResult')).toContainText('Returned', { timeout: 10_000 });
    await expectSlotReelsUseSymbolImages(alice);
    await expect(bob.locator('#slotsRoomPlayers')).toContainText('Paid');

    const beforeDuplicateAttempt = await transactionCount(alice, 'Room');
    await alice.locator('#slotsSpinBtn').evaluate((button) => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await alice.waitForTimeout(250);
    await expect.poll(() => transactionCount(alice, 'Room')).toBe(beforeDuplicateAttempt);
  } finally {
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  }
});

const startRealtimeServer = async (profileNames: readonly string[]): Promise<string> => {
  return startRealtimeServerWithStore(seedDataStore(profileNames));
};

const seedDataStore = (profileNames: readonly string[]): ServerDataStore => {
  const dataStore = createMemoryServerDataStore();
  for (const profileName of profileNames) {
    dataStore.createProfile(profileName);
  }
  return dataStore;
};

const startRealtimeServerWithStore = async (dataStore: ServerDataStore, port = 0): Promise<string> => {
  realtimeServer = createCasinoServer({ dataStore, heartbeatTimeoutMs: 300_000 });
  await new Promise<void>((resolve) => realtimeServer?.listen(port, '127.0.0.1', resolve));
  const address = realtimeServer.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}/ws`;
};

const closeRealtimeServer = async (): Promise<void> => {
  if (!realtimeServer) {
    return;
  }
  realtimeServer.closePeers();
  realtimeServer.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    realtimeServer?.close((error) => (error ? reject(error) : resolve()));
  });
  realtimeServer = undefined;
};

const newPlayerContext = async (browser: Browser, wsUrl: string): Promise<BrowserContext> => {
  const context = await browser.newContext();
  await context.addInitScript((url) => {
    if (!localStorage.getItem('casino_e2e_context_ready')) {
      localStorage.clear();
      localStorage.setItem('casino_e2e_context_ready', 'true');
    }
    localStorage.setItem('casino_realtime_url', url);
  }, wsUrl);
  return context;
};

const newPlayerPage = async (context: BrowserContext, baseURL: string | undefined, name: string): Promise<Page> => {
  const page = await context.newPage();
  await page.goto(baseURL ?? '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await waitForRealtime(page);
  await expect(page.locator('#profileList')).toContainText(name);
  await startExistingProfileSession(page, name);
  return page;
};

const startExistingProfileSession = async (page: Page, name: string): Promise<void> => {
  const row = page.locator('.profile-row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.locator('[data-profile-select]').check();
  await page.getByRole('button', { name: 'Start Selected Session' }).click();
};

const waitForRealtime = async (page: Page): Promise<void> => {
  await expect(page.locator('#connectionOverlay')).toBeHidden({ timeout: 15_000 });
};

const claimRoomSeat = async (page: Page, seatLabel: string): Promise<void> => {
  await page.locator('#roomMenu').evaluate((element) => {
    (element as HTMLDetailsElement).open = true;
  });
  const seatButton = page.locator('#roomSeats').getByRole('button', { name: `${seatLabel}: open` });
  await expect(seatButton).toBeVisible();
  await seatButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
};

const dropChipPercent = async (page: Page, xPercent: number, yPercent: number, amount: number): Promise<void> => {
  await page.locator('#tableHost').evaluate(
    (host, point) => {
      const box = host.getBoundingClientRect();
      const scale = Math.min(box.width / 1672, box.height / 941);
      const xOffset = (box.width - 1672 * scale) / 2;
      const yOffset = (box.height - 941 * scale) / 2;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', String(point.amount));
      host.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          clientX: box.left + xOffset + 1672 * scale * (point.xPercent / 100),
          clientY: box.top + yOffset + 941 * scale * (point.yPercent / 100),
          dataTransfer,
        }),
      );
    },
    { xPercent, yPercent, amount },
  );
};

const parsedDataset = async (page: Page, key: string): Promise<unknown[]> =>
  page.locator('#tableHost').evaluate((element, datasetKey) => JSON.parse(element.dataset[datasetKey] ?? '[]') as unknown[], key);

const tableAmount = async (page: Page): Promise<number> => {
  const text = await page.locator('#onTable').textContent();
  return Number((text ?? '').replace(/[£,]/g, '')) || 0;
};

const transactionCount = async (page: Page, text: string): Promise<number> =>
  page.evaluate(async (needle) => {
    const url = localStorage.getItem('casino_realtime_url') ?? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const store = await new Promise<{ readonly profiles?: readonly { readonly transactions?: readonly { readonly description?: string }[] }[] }>((resolve, reject) => {
      const socket = new WebSocket(url);
      const timer = window.setTimeout(() => {
        socket.close();
        reject(new Error('Timed out reading server data.'));
      }, 5_000);
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ version: 1, type: 'request-data' }));
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as {
          type?: string;
          profileState?: { profiles?: readonly { readonly transactions?: readonly { readonly description?: string }[] }[] };
        };
        if (message.type === 'data-state' && message.profileState) {
          window.clearTimeout(timer);
          socket.close();
          resolve(message.profileState);
        }
      });
      socket.addEventListener('error', () => {
        window.clearTimeout(timer);
        reject(new Error('Failed to connect while reading server data.'));
      });
    });
    return (store.profiles ?? []).flatMap((profile) => profile.transactions ?? []).filter((transaction) => transaction.description?.includes(needle)).length;
  }, text);

const expectSlotReelsUseSymbolImages = async (page: Page): Promise<void> => {
  await expect(page.locator('#slotReels [data-slot-symbol]')).toHaveCount(15);
  await expect(page.locator('#slotReels [data-slot-column="3"][data-slot-row="5"]')).toHaveCount(1);
  await expect(page.locator('#slotReels .slot-symbol-img')).toHaveCount(15);
  await expect.poll(() => page.locator('#slotReels').evaluate((element) => element.textContent?.trim() ?? '')).toBe('');
  await expect
    .poll(() =>
      page.locator('#slotReels .slot-symbol-img').evaluateAll((images) =>
        images.map((image) => {
          const element = image as HTMLImageElement;
          return {
            complete: element.complete,
            naturalHeight: element.naturalHeight,
            naturalWidth: element.naturalWidth,
            src: element.currentSrc || element.src,
          };
        }),
      ),
    )
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ complete: true, naturalHeight: 512, naturalWidth: 512, src: expect.stringMatching(/\/assets\/slots\/symbols\/.+\.png$/) }),
        expect.objectContaining({ complete: true, naturalHeight: 512, naturalWidth: 512, src: expect.stringMatching(/\/assets\/slots\/symbols\/.+\.png$/) }),
        expect.objectContaining({ complete: true, naturalHeight: 512, naturalWidth: 512, src: expect.stringMatching(/\/assets\/slots\/symbols\/.+\.png$/) }),
      ]),
    );
};
