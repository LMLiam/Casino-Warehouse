import { expect, test, type Browser, type Page } from '@playwright/test';

const smokeUrl = process.env.NGROK_SMOKE_URL;

test.describe('ngrok multiplayer smoke', () => {
  test.skip(!smokeUrl, 'Set NGROK_SMOKE_URL to run the public tunnel smoke test.');

  test('desktop and tablet browser contexts share a Beat the House room through ngrok', async ({ browser }, testInfo) => {
    test.setTimeout(75_000);
    test.skip(testInfo.project.name !== 'laptop', 'This smoke test creates its own desktop and tablet contexts.');
    if (!smokeUrl) {
      throw new Error('NGROK_SMOKE_URL is required.');
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

      await tablet.reload();
      await tablet.waitForFunction(() => document.body.dataset.appReady === 'true');
      await tablet.locator('[data-lobby-game="beat-the-house"]').click();
      await tablet.getByRole('button', { name: 'Refresh Rooms' }).click();
      await tablet.locator(`[data-room-join="${roomId}"]`).click();
      await expect(tablet.locator('#roomStatus')).toContainText(`room ${roomId}`);
      await expect(tablet.locator('#onTable')).toContainText('£25');
    } finally {
      await desktop.close();
      await tablet.close();
    }
  });
});

const openSmokePage = async (browser: Browser, viewport: { readonly width: number; readonly height: number }): Promise<Page> => {
  const context = await browser.newContext({
    viewport,
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': 'true' },
  });
  const page = await context.newPage();
  await page.goto(smokeUrl!, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  return page;
};

const createSession = async (page: Page, name: string): Promise<void> => {
  await page.getByPlaceholder('Player name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('[data-profile-select]:not(:disabled)').last().check();
  await page.getByRole('button', { name: 'Start Selected Session' }).click();
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
