import { expect, test, type Browser, type Page } from '@playwright/test';

const smokeUrl = process.env.PUBLIC_TUNNEL_SMOKE_URL ?? process.env.NGROK_SMOKE_URL;
const smokeUrlSource = process.env.PUBLIC_TUNNEL_SMOKE_URL ? 'PUBLIC_TUNNEL_SMOKE_URL' : 'NGROK_SMOKE_URL';

const requireSmokeUrl = (): string => {
  if (!smokeUrl) {
    throw new Error(`${smokeUrlSource} is required.`);
  }
  return smokeUrl;
};
const appReadyTimeoutMs = 30_000;
const navigationAttempts = 3;
const smokeTestTimeoutMs = 240_000;

test.describe('public tunnel multiplayer smoke', () => {
  test.skip(!smokeUrl, 'Set PUBLIC_TUNNEL_SMOKE_URL to run the public tunnel smoke test.');

  test('desktop and tablet browser contexts share a Beat the House room through a public tunnel', async ({ browser }, testInfo) => {
    test.setTimeout(smokeTestTimeoutMs);
    test.skip(testInfo.project.name !== 'laptop', 'This smoke test creates its own desktop and tablet contexts.');
    if (!smokeUrl) {
      throw new Error(`${smokeUrlSource} is required.`);
    }

    const desktop = await openSmokePage(browser, { width: 1366, height: 768 });
    const tablet = await openSmokePage(browser, { width: 1024, height: 768 });

    try {
      await createSession(desktop, 'Desktop Smoke');
      await createSession(tablet, 'Tablet Smoke');

      await desktop.locator('[data-lobby-game="beat-the-house"]').click();
      await desktop.getByRole('button', { name: 'Create Room' }).click();
      await expect(desktop.locator('#roomStatus')).toContainText(/room [A-Z0-9]+/);
      await expect(desktop.locator('#tableHost')).toBeVisible();
      await claimRoomSeat(desktop, 'Left');
      const roomStatus = await desktop.locator('#roomStatus').textContent();
      const roomId = roomStatus?.match(/room ([A-Z0-9]+)/)?.[1];
      if (!roomId) {
        throw new Error(`Room id was not present in status: ${roomStatus ?? ''}`);
      }

      await tablet.locator('[data-lobby-game="beat-the-house"]').click();
      await tablet.locator(`[data-room-join="${roomId}"]`).click();
      await expect(tablet.locator('#roomStatus')).toContainText(`room ${roomId}`);
      await expect(tablet.locator('#tableHost')).toBeVisible();
      await claimRoomSeat(tablet, 'Centre');

      await expect(desktop.locator('#roomSeats')).toContainText('Left: Desktop Smoke', { timeout: 10_000 });
      await expect(tablet.locator('#roomSeats')).toContainText('Left: Desktop Smoke', { timeout: 10_000 });
      await expect(desktop.locator('#roomSeats')).toContainText('Centre: Tablet Smoke', { timeout: 15_000 });
      await expect(tablet.locator('#roomSeats')).toContainText('Centre: Tablet Smoke', { timeout: 15_000 });

      await dropChipOnTable(desktop, { amount: 25, zone: { x: 19.25, y: 70.55 } });
      await expect(tablet.locator('#onTable')).toContainText('£25');
      await expect(desktop.locator('#bankroll')).toContainText('£975');

      await waitForSmokePageReload(tablet);
      await restoreSmokeRoom(tablet, roomId);
      await expect(tablet.locator('#roomStatus')).toContainText(`room ${roomId}`);
      await expect(tablet.locator('#onTable')).toContainText('£25');
    } finally {
      await desktop.close();
      await tablet.close();
    }
  });
});

const openSmokePage = async (browser: Browser, viewport: { readonly width: number; readonly height: number }): Promise<Page> => {
  const extraHTTPHeaders = publicTunnelSmokeHeaders(smokeUrl);
  const context = await browser.newContext({
    viewport,
    ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}),
  });
  await context.addInitScript(() => {
    if (sessionStorage.getItem('publicTunnelSmokeStorageCleared')) {
      return;
    }
    localStorage.clear();
    sessionStorage.setItem('publicTunnelSmokeStorageCleared', 'true');
  });
  const page = await context.newPage();
  await waitForSmokePage(page);
  return page;
};

const waitForSmokePage = async (page: Page): Promise<void> => {
  const url = requireSmokeUrl();
  for (let attempt = 1; attempt <= navigationAttempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await waitForSmokeAppReady(page);
      return;
    } catch (error) {
      if (attempt === navigationAttempts) {
        throw error;
      }
      await page.waitForTimeout(1_000);
    }
  }
};

const waitForSmokePageReload = async (page: Page): Promise<void> => {
  const url = requireSmokeUrl();
  for (let attempt = 1; attempt <= navigationAttempts; attempt += 1) {
    try {
      if (attempt === 1) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
      } else {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      }
      await waitForSmokeAppReady(page);
      return;
    } catch (error) {
      if (attempt === navigationAttempts) {
        throw error;
      }
      await page.waitForTimeout(1_000);
    }
  }
};

const waitForSmokeAppReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () =>
      document.body.dataset.appReady === 'true' ||
      Boolean(document.querySelector('#tableHost, [data-lobby-game="beat-the-house"], input[placeholder="Player name"]')),
    undefined,
    { timeout: appReadyTimeoutMs },
  );
};

const restoreSmokeRoom = async (page: Page, roomId: string): Promise<void> => {
  try {
    await expect(page.locator('#roomStatus')).toContainText(`room ${roomId}`, { timeout: 15_000 });
    return;
  } catch {
    await page.locator('[data-lobby-game="beat-the-house"]').click();
    await page.getByRole('button', { name: 'Refresh Rooms' }).click();
    const joinButton = page.locator(`[data-room-join="${roomId}"]`).first();
    await expect(joinButton).toBeVisible({ timeout: 15_000 });
    await joinButton.click();
  }
};

const publicTunnelSmokeHeaders = (url: string | undefined): Record<string, string> | undefined => {
  const headers: Record<string, string> = {};
  if (usesNgrokBrowserWarning(url)) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  if (usesLocaltunnelReminder(url)) {
    headers['bypass-tunnel-reminder'] = 'true';
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
};

const usesNgrokBrowserWarning = (url: string | undefined): boolean => {
  if (!url) {
    return false;
  }
  if (process.env.NGROK_SMOKE_URL && !process.env.PUBLIC_TUNNEL_SMOKE_URL) {
    return true;
  }
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith('.ngrok-free.dev') || hostname.endsWith('.ngrok.app') || hostname.endsWith('.ngrok.io');
  } catch {
    return false;
  }
};

const usesLocaltunnelReminder = (url: string | undefined): boolean => {
  if (!url) {
    return false;
  }
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'loca.lt' || hostname.endsWith('.loca.lt') || hostname === 'localtunnel.me' || hostname.endsWith('.localtunnel.me');
  } catch {
    return false;
  }
};

const createSession = async (page: Page, name: string): Promise<void> => {
  await page.getByPlaceholder('Player name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('[data-profile-select]:not(:disabled)').last().check();
  await page.getByRole('button', { name: 'Start Profile Session' }).click();
};

const claimRoomSeat = async (page: Page, seatLabel: string): Promise<void> => {
  const seatButton = page.getByRole('button', { name: `Claim ${seatLabel} seat` });
  await expect(seatButton).toBeVisible();
  await seatButton.click();
};

const dropChipOnTable = async (page: Page, options: { readonly amount: number; readonly zone: { readonly x: number; readonly y: number } }): Promise<void> => {
  await page.locator('#tableHost').evaluate((host, { amount, zone }) => {
    const tableSize = { width: 1672, height: 941 };
    const rect = host.getBoundingClientRect();
    const scale = Math.min(rect.width / tableSize.width, rect.height / tableSize.height);
    const renderedWidth = tableSize.width * scale;
    const renderedHeight = tableSize.height * scale;
    const clientX = rect.left + (rect.width - renderedWidth) / 2 + renderedWidth * (zone.x / 100);
    const clientY = rect.top + (rect.height - renderedHeight) / 2 + renderedHeight * (zone.y / 100);
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', String(amount));
    host.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
  }, options);
};
