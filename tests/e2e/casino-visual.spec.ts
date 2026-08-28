import { e2eAdminToken, expect, test, resetBrowserStorage, type Locator, type Page } from './fixtures';

const consoleFailures = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, realtimeUrl }) => {
  const failures: string[] = [];
  consoleFailures.set(page, failures);
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    failures.push(error.message);
  });

  await page.goto('/');
  await resetBrowserStorage(page, realtimeUrl);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await waitForRealtime(page);
  await clearServerData(page);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await waitForRealtime(page);
});

test('profile lobby and game tiles render without overflowing key text', async ({ page }) => {
  await createSession(page);

  await expect(page.getByRole('heading', { name: 'Casino Warehouse' })).toBeVisible();
  await expect(page.locator('[data-lobby-game="beat-the-house"]')).toBeVisible();
  await expect(page.locator('[data-lobby-game="blackjack"]')).toBeVisible();
  await expect(page.locator('[data-lobby-game="slots:thai-princess"]')).toBeVisible();
  await expect(page.locator('[data-lobby-game^="slots:"]')).toHaveCount(1);
  await expect(page.locator('#gameLobby .fictional-notice')).toContainText('Fictional currency only');
  const primaryHud = page.locator('#gameHud > .hud-button-row').first();
  await expect(primaryHud.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(primaryHud.locator('summary')).toHaveCount(0);
  await expect(primaryHud.locator('summary').filter({ hasText: /^Games$/ })).toHaveCount(0);
  await expect(primaryHud.locator('summary').filter({ hasText: /^Rules$/ })).toHaveCount(0);
  await expect(primaryHud.locator('summary').filter({ hasText: /^Paytable$/ })).toHaveCount(0);
  await expect(page.locator('#hudOverflowButton')).toBeVisible();
  await openHudOverflow(page);
  const overflowPanel = page.locator('#hudOverflowPanel');
  await expect(overflowPanel.getByRole('button', { name: 'Switch Profile' })).toBeVisible();
  await expect(overflowPanel.getByRole('button', { name: 'Exit Room' })).toBeHidden();
  await expect(overflowPanel.locator('[data-hud-section="info"] > summary')).toBeVisible();
  await expect(overflowPanel.locator('[data-hud-section="profile"] > summary')).toBeVisible();
  await expect(overflowPanel.locator('[data-hud-section="stats"] > summary')).toBeVisible();
  await expect(overflowPanel.locator('[data-hud-section="admin"] > summary')).toBeVisible();
  await expect(overflowPanel.locator('[data-hud-section="room"]')).toBeHidden();
  await openHudSection(page, 'info');
  await expect(page.locator('#beatRules')).toContainText('Play up to three hands');
  await expect(page.locator('#beatPaytable')).toContainText('Dealer Sevens');
  await openHudSection(page, 'profile');
  await expect(page.locator('#playerStrip')).toContainText('QA Player');
  await openHudSection(page, 'stats');
  await expect(page.locator('#profileStats')).toContainText('Wagered');
  await expect(page.locator('#onTable')).toContainText('£0');
  await openHudSection(page, 'admin');
  await expect(page.locator('#authorizeAdminBtn')).toBeVisible();
  await expect(page.locator('#roomMenu')).toBeHidden();

  await expectNoHorizontalOverflow(page.locator('.game-shell'));
  await page.keyboard.press('Escape');
  await expect(page.locator('#hudOverflowPanel')).toBeHidden();
  await openHudOverflow(page);
  await overflowPanel.getByRole('button', { name: 'Switch Profile' }).click();
  await expect(page.locator('#setup')).toBeVisible();
  expectConsoleClean(page);
});

test('Radix setup dialogs trap focus and close with Escape', async ({ page }) => {
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');

  await expect(page.getByRole('button', { name: 'Backup' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Audio' }).click();
  const audioDialog = page.getByRole('dialog', { name: 'Audio' });
  await expect(audioDialog).toBeVisible();
  await expect(page.getByLabel('Master')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(audioDialog).toBeHidden();
  expectConsoleClean(page);
});

test('profile page hides storage internals while row actions preserve server-backed profiles', async ({ page }) => {
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await expect(page.locator('#saveStatus')).not.toContainText('SQLite');
  await expect(page.locator('#saveStatus')).not.toContainText('Server-owned');
  await expect(page.getByRole('button', { name: 'Backup' })).toHaveCount(0);

  await page.getByPlaceholder('Player name').fill('Profile QA');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('#profileList')).toContainText('Profile QA');
  await expect(page.locator('[data-profile-select]')).toHaveAttribute('type', 'radio');
  await page.locator('[data-profile-select]').check();

  await page.locator('[data-profile-action="rename"]').click();
  await expect(page.getByLabel('New profile name')).toBeVisible();
  await page.getByLabel('New profile name').fill('Renamed QA');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#profileList')).toContainText('Renamed QA');
  await expect(page.locator('[data-profile-select]')).toBeChecked();

  await page.locator('[data-profile-action="delete"]').click();
  await expect(page.getByRole('alert')).toContainText('Delete Renamed QA?');
  await page.getByRole('button', { name: 'Delete Profile' }).click();
  await expect(page.locator('#profileList')).toContainText('Create a profile');
  await expect(page.getByRole('button', { name: 'Start Profile Session' })).toBeDisabled();
  expectConsoleClean(page);
});

test('profile setup starts one selected local profile', async ({ page }) => {
  await page.getByPlaceholder('Player name').fill('First QA');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByPlaceholder('Player name').fill('Second QA');
  await page.getByRole('button', { name: 'Create' }).click();

  const firstRow = page.locator('.profile-row').filter({ hasText: 'First QA' });
  const secondRow = page.locator('.profile-row').filter({ hasText: 'Second QA' });
  const firstSelect = firstRow.locator('[data-profile-select]');
  const secondSelect = secondRow.locator('[data-profile-select]');
  await expect(firstSelect).toHaveAttribute('type', 'radio');
  await expect(secondSelect).toHaveAttribute('type', 'radio');
  await firstSelect.check();
  await secondSelect.check();
  await expect(firstSelect).not.toBeChecked();
  await expect(secondSelect).toBeChecked();
  const selectedProfileId = await secondSelect.inputValue();

  await page.getByRole('button', { name: 'Start Profile Session' }).click();
  await expect(page.locator('#gameLobby')).toBeVisible();
  await expect(page.locator('#playerStrip')).toContainText('Second QA');
  await expect(page.locator('#playerStrip [data-player]')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('casino_warehouse_session_v2');
        return raw ? JSON.parse(raw).profileId : '';
      }),
    )
    .toBe(selectedProfileId);
  expectConsoleClean(page);
});

test('audio mute and volume controls persist across reloads', async ({ page }) => {
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await page.getByRole('button', { name: 'Audio' }).click();
  await page.getByLabel('Mute').check();
  await setRangeValue(page.locator('#masterVolume'), '0.35');
  await setRangeValue(page.locator('#musicVolume'), '0');

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('casino_audio_settings_v1');
        return raw ? JSON.parse(raw) : undefined;
      }),
    )
    .toMatchObject({ muted: true, masterVolume: 0.35, musicVolume: 0 });

  await page.reload();
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await page.getByRole('button', { name: 'Audio' }).click();
  await expect(page.getByLabel('Mute')).toBeChecked();
  await expect(page.locator('#masterVolume')).toHaveValue('0.35');
  await expect(page.locator('#musicVolume')).toHaveValue('0');
  expectConsoleClean(page);
});

test('admin bankroll adjustments update wallet and audit ledger without corrupting profile storage', async ({ page }) => {
  await createSession(page);

  await openHudSection(page, 'admin');
  await page.locator('#moneyInput').fill('125');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('#bankroll')).toContainText('£1,125');
  await expect(page.locator('#auditLog')).toContainText('Admin bankroll add');

  await page.getByRole('button', { name: 'Subtract' }).click();
  await expect(page.locator('#bankroll')).toContainText('£1,000');
  await expect(page.locator('#auditLog')).toContainText('Admin bankroll subtract');

  const serverData = await requestServerData(page);
  const savedProfile = serverData.profileState.profiles.find((profile) => profile.name === 'QA Player');
  expect(savedProfile).toMatchObject({
    bankroll: 1000,
    transactions: [
      { type: 'admin_adjustment', amount: -125, description: 'Admin bankroll subtract' },
      { type: 'admin_adjustment', amount: 125, description: 'Admin bankroll add' },
    ],
  });
  expectConsoleClean(page);
});

test('House Advance offer, owed balance, and capped-state messaging render in the lobby and wallet', async ({ page }) => {
  await createSession(page);
  await openHudSection(page, 'admin');
  await page.locator('#moneyInput').fill('1000');
  await page.getByRole('button', { name: 'Subtract' }).click();

  await expect(page.locator('#bankroll')).toContainText('£0');
  await expect(page.locator('#houseAdvancePanel')).toBeVisible();
  await expect(page.locator('#houseAdvancePanel')).toContainText('House Advance available');
  await expect(page.locator('#houseAdvancePanel')).toContainText('Future net wins repay 10%');

  await page.getByRole('button', { name: 'Take House Advance' }).click();
  await expect(page.locator('#bankroll')).toContainText('£100');
  await expect(page.locator('#houseAdvancePill')).toContainText('House Advance owed: £100 · 1/3 active');
  await openHudSection(page, 'stats');
  await expect(page.locator('#profileStats')).toContainText('House Advance owed £100');
  await expect(page.locator('#auditLog')).toContainText('House Advance accepted');

  for (let count = 2; count <= 3; count += 1) {
    await openHudSection(page, 'admin');
    await page.locator('#moneyInput').fill('100');
    await page.getByRole('button', { name: 'Subtract' }).click();
    await expect(page.locator('#bankroll')).toContainText('£0');
    await page.getByRole('button', { name: 'Take House Advance' }).click();
    await expect(page.locator('#houseAdvancePill')).toContainText(`House Advance owed: £${count}00 · ${count}/3 active`);
  }

  await openHudSection(page, 'admin');
  await page.locator('#moneyInput').fill('100');
  await page.getByRole('button', { name: 'Subtract' }).click();
  await expect(page.locator('#bankroll')).toContainText('£0');
  await expect(page.locator('#houseAdvancePanel')).toContainText('House Advance unavailable');
  await expect(page.locator('#houseAdvancePanel')).toContainText('unavailable until the current £300 balance is repaid');
  await expect(page.getByRole('button', { name: 'Take House Advance' })).toBeHidden();

  const serverData = await requestServerData(page);
  const savedProfile = serverData.profileState.profiles.find((profile) => profile.name === 'QA Player');
  expect(savedProfile).toMatchObject({
    bankroll: 0,
    houseAdvance: { outstandingBalance: 300, activeCount: 3 },
    transactions: expect.arrayContaining([
      expect.objectContaining({ type: 'admin_adjustment', amount: -100 }),
      expect.objectContaining({ type: 'house_advance_credit', amount: 100 }),
    ]),
  });
  expectConsoleClean(page);
});

test('blackjack has its own table rendering', async ({ page }) => {
  await createSession(page);
  await page.locator('[data-lobby-game="blackjack"]').click();

  await expect(page.locator('#roomLobby')).toBeVisible();
  await expect(page.locator('.blackjack-table-felt')).toBeHidden();
  await expect(page.locator('.table-host')).toBeHidden();
  await expect(page.locator('#roomGameTitle')).toContainText('Blackjack');
  await expect(page.locator('#blackjackRules')).toContainText('Dealer stands on soft 17');

  await expectNoHorizontalOverflow(page.locator('#roomLobby'));
  expectConsoleClean(page);
});

test('slot themes expose bonus, jackpot, and paytable surfaces', async ({ page }) => {
  await createSession(page);
  await page.locator('[data-lobby-game="slots:thai-princess"]').click();

  await expect(page.locator('#roomLobby')).toBeVisible();
  await expect(page.locator('#roomGameTitle')).toContainText('Thai Princess');
  await expect(page.locator('#slotsPaytable')).toContainText('princess substitutes');
  await expect(page.locator('#slotsRules')).toContainText('3 column by 5 row grid');
  await expect(page.locator('#slotsRules')).toContainText('lotus scatter-style');

  await expectNoHorizontalOverflow(page.locator('#roomLobby'));
  expectConsoleClean(page);
});

test('Beat the House selection opens the multiplayer room lobby before table play', async ({ page }) => {
  await createSession(page);
  await page.locator('[data-lobby-game="beat-the-house"]').click();

  await expect(page.locator('#roomLobby')).toBeVisible();
  await expect(page.locator('#roomGameTitle')).toContainText('Beat the House');
  await expect(page.locator('#roomMaxPlayersInput')).toHaveAttribute('max', '3');
  await expect(page.locator('#roomMaxPlayersInput')).toHaveValue('3');
  await expect(page.locator('#roomBrowser')).toContainText('Beat the House Main Room');
  await openHudOverflow(page);
  await expect(page.locator('#roomMenu')).toBeHidden();
  await expect(page.locator('#leaveRoomBtn')).toBeHidden();
  await expect(page.locator('#tableHost')).toBeHidden();
  await expect(page.locator('#chipRail')).toBeHidden();
  await page.getByRole('button', { name: 'Join Room' }).first().click();
  await expect(page.locator('#tableHost')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home' })).toBeEnabled();
  await openHudOverflow(page);
  await expect(page.locator('#roomMenu')).toBeVisible();
  await expect(page.locator('#leaveRoomBtn')).toBeVisible();
  await expect(page.locator('#chipRail')).toBeHidden();
  await openHudSection(page, 'room');
  await page.locator('#roomSeats').getByRole('button', { name: 'Left: open' }).click();
  await expect(page.locator('#roomSeats')).toContainText('Left: QA Player');
  await expect(page.locator('#chipRail')).toBeVisible();
  await expect(page.getByLabel('£1000 chip')).toBeVisible();
  await expect(page.getByLabel('£5000 chip')).toBeHidden();
  await expect(page.getByLabel('£10000 chip')).toBeHidden();

  await page.getByLabel('£1000 chip').click();
  await expect(page.getByLabel('£1000 chip')).toHaveClass(/selected/);
  await dropChipPercent(page, 19.25, 70.55, 1000);
  await expect(page.locator('#bankroll')).toContainText('£0');
  await expect(page.locator('#chipRail')).toBeHidden();
  await expect(page.locator('.chip-button.selected')).toHaveCount(0);
  expectConsoleClean(page);
});

test('Beat the House room action dock follows the right seat without layout collisions', async ({ page }) => {
  await createSession(page);
  await page.locator('[data-lobby-game="beat-the-house"]').click();
  await page.getByRole('button', { name: 'Join Room' }).first().click();
  await expect(page.locator('#tableHost')).toBeVisible();
  await openHudSection(page, 'room');
  const rightSeat = page.locator('#roomSeats').getByRole('button', { name: 'Right: open' });
  await expect(rightSeat).toBeVisible();
  await rightSeat.click();
  await expect(rightSeat).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('#roomSeats')).toContainText('Right: QA Player');

  await page.getByLabel('£25 chip').click();
  await dropChipPercent(page, 80.85, 70.55, 25);
  await expect(page.locator('.seat-status-pill.mine')).toContainText('Wagered', { timeout: 10_000 });
  await expectBeatActionDockClearOfMineSeat(page, '#dealBtn');
  await expectBeatActionDockClearOfMineSeat(page, '#clearBtn');
  expectConsoleClean(page);
});

test('tablet room lobby opens without moving the active table canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await createSession(page);
  await page.locator('[data-lobby-game="beat-the-house"]').click();
  await expect(page.locator('#roomLobby')).toBeVisible();

  const before = await boundingBox(page.locator('#roomLobby'));
  await page.getByRole('button', { name: 'Refresh Rooms' }).click();
  const after = await boundingBox(page.locator('#roomLobby'));

  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect(after.height).toBeCloseTo(before.height, 0);
  expectConsoleClean(page);
});

test('game lobby no longer exposes local-only table play before joining a room', async ({ page }) => {
  await createSession(page);
  await page.locator('[data-lobby-game="beat-the-house"]').click();

  await expect(page.locator('#roomLobby')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deal' })).toBeHidden();
  expectConsoleClean(page);
});

test('multiplayer invite URLs load hidden direct-join state without manual room controls', async ({ page }) => {
  const wsUrl = await page.evaluate(() => `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
  await page.goto(`/?game=blackjack&room=abc123&server=${encodeURIComponent(wsUrl)}`);
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await waitForRealtime(page);

  await expect(page.locator('#roomIdInput')).toHaveCount(0);
  await expect(page.locator('#roomServerInput')).toHaveCount(0);
  await expect(page.locator('#roomConnectBtn')).toHaveCount(0);
  await expect(page.locator('#roomStatus')).toContainText('Invite loaded for room ABC123');
  expectConsoleClean(page);
});

test('disconnected clients show a reconnecting screen and block profile actions', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('casino_realtime_url', 'ws://127.0.0.1:9/ws'));
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await expect(page.locator('#connectionOverlay')).toBeVisible();
  await expect(page.locator('#connectionOverlay')).toContainText('Connection interrupted');
  await expect(page.locator('#connectionOverlay')).not.toContainText('Realtime');

  await page.getByPlaceholder('Player name').fill('Offline QA');
  await page.getByRole('button', { name: 'Create' }).click({ force: true });
  await expect(page.locator('#profileList')).not.toContainText('Offline QA');
  await expect(page.locator('#roomStatus')).toContainText('Actions are paused');
});

test('room browser UX uses per-game cards with join and spectate actions', async ({ page }) => {
  await createSession(page);
  await page.locator('[data-lobby-game="blackjack"]').click();

  await expect(page.locator('#roomServerInput')).toHaveCount(0);
  await expect(page.locator('#roomIdInput')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh Rooms' })).toBeVisible();
  await expect(page.locator('#roomBrowser')).toContainText('No rooms for this game yet.');
  expectConsoleClean(page);
});

test('phone-sized screens show the unsupported-device message', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Desktop or tablet required' })).toBeVisible();
  await expect(page.locator('#setup')).toBeHidden();
  expectConsoleClean(page);
});

const createSession = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await waitForRealtime(page);
  await page.getByPlaceholder('Player name').fill('QA Player');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('#profileList')).toContainText('QA Player');
  await page.locator('[data-profile-select]').check();
  await page.getByRole('button', { name: 'Start Profile Session' }).click();
};

const expectNoHorizontalOverflow = async (locator: Locator): Promise<void> => {
  await expect(locator).toBeVisible();
  const overflow = await locator.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
};

const expectBeatActionDockClearOfMineSeat = async (page: Page, actionSelector: string): Promise<void> => {
  await expect(page.locator(actionSelector)).toBeVisible();
  await expect(page.locator('#actionDock')).toHaveAttribute('data-beat-seat', /^(left|centre|right)$/);
  const actionDock = await boundingBox(page.locator('#actionDock'));
  const mineSeat = await boundingBox(page.locator('.seat-status-pill.mine'));
  const moneyPill = await boundingBox(page.locator('#moneyPill'));
  expect(boxesOverlap(actionDock, mineSeat)).toBe(false);
  expect(boxesOverlap(actionDock, moneyPill)).toBe(false);
  if (await page.locator('#chipRail').isVisible()) {
    expect(boxesOverlap(actionDock, await boundingBox(page.locator('#chipRail')))).toBe(false);
  }
  await expectNoHorizontalOverflow(page.locator('.game-shell'));
};

type HudSection = 'admin' | 'info' | 'profile' | 'room' | 'stats';

const openHudOverflow = async (page: Page): Promise<void> => {
  const menu = page.locator('#hudOverflowMenu');
  if (!(await menu.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await page.locator('#hudOverflowButton').click();
  }
  await expect(page.locator('#hudOverflowPanel')).toBeVisible();
};

const openHudSection = async (page: Page, sectionName: HudSection): Promise<void> => {
  await openHudOverflow(page);
  const section = page.locator(`[data-hud-section="${sectionName}"]`);
  if (!(await section.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await section.locator('summary').first().click();
  }
  await expect(section).toBeVisible();
};

const setRangeValue = async (locator: Locator, value: string): Promise<void> => {
  await locator.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = nextValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
};

const boundingBox = async (locator: Locator): Promise<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number }> => {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Expected locator to have a bounding box.');
  }
  return box;
};

const boxesOverlap = (
  first: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  second: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean => first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y;

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

const expectConsoleClean = (page: Page): void => {
  expect(consoleFailures.get(page) ?? []).toEqual([]);
};

type E2EServerProfile = {
  readonly name?: string;
  readonly bankroll?: number;
  readonly houseAdvance?: E2EServerHouseAdvance;
  readonly transactions?: readonly E2EServerTransaction[];
};

type E2EServerHouseAdvance = {
  readonly outstandingBalance?: number;
  readonly activeCount?: number;
};

type E2EServerTransaction = {
  readonly type?: string;
  readonly amount?: number;
  readonly description?: string;
};

type E2EServerData = {
  readonly profileState: {
    readonly profiles: readonly E2EServerProfile[];
  };
};

type E2EDataStateMessage = {
  readonly type?: string;
  readonly authorized?: boolean;
  readonly profileState?: { readonly profiles?: readonly E2EServerProfile[] };
  readonly session?: { readonly version?: number };
};

const waitForRealtime = async (page: Page): Promise<void> => {
  await expect(page.locator('#connectionOverlay')).toBeHidden({ timeout: 10_000 });
};

const clearServerData = async (page: Page): Promise<void> => {
  await page.evaluate(async (adminToken) => {
    const url = localStorage.getItem('casino_realtime_url') ?? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url);
      let authorized = false;
      const timer = window.setTimeout(() => {
        socket.close();
        reject(new Error('Timed out clearing server data.'));
      }, 5_000);
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ version: 1, type: 'authorize-admin', adminToken }));
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as E2EDataStateMessage;
        if (message.type === 'admin-access' && message.authorized && !authorized) {
          authorized = true;
          socket.send(JSON.stringify({ version: 1, type: 'clear-server-data' }));
        }
        if (message.type === 'data-state' && message.profileState?.profiles?.length === 0 && message.session === undefined) {
          window.clearTimeout(timer);
          socket.close();
          resolve();
        }
      });
      socket.addEventListener('error', () => {
        window.clearTimeout(timer);
        reject(new Error('Failed to connect while clearing server data.'));
      });
    });
  }, e2eAdminToken);
};

const requestServerData = async (page: Page): Promise<E2EServerData> =>
  page.evaluate(async () => {
    const url = localStorage.getItem('casino_realtime_url') ?? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    return await new Promise<E2EServerData>((resolve, reject) => {
      const socket = new WebSocket(url);
      const timer = window.setTimeout(() => {
        socket.close();
        reject(new Error('Timed out reading server data.'));
      }, 5_000);
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ version: 1, type: 'request-data' }));
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as { type?: string; profileState?: E2EServerData['profileState'] };
        if (message.type === 'data-state' && message.profileState) {
          window.clearTimeout(timer);
          socket.close();
          resolve({ profileState: message.profileState });
        }
      });
      socket.addEventListener('error', () => {
        window.clearTimeout(timer);
        reject(new Error('Failed to connect while reading server data.'));
      });
    });
  });
