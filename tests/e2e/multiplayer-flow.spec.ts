import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import type { AddressInfo } from 'node:net';
import type { Card } from '../../src/game/cards/Card';
import { rigDeck } from '../../src/game/cards/rigDeck';
import type { JsonValue } from '../../src/schemas/casinoSchemas/JsonValue';
import { createCasinoServer, type CasinoRoomAuthority, type CasinoServer } from '../../src/multiplayer/serverEntry';
import { RoomAuthority } from '../../src/multiplayer/roomAuthority';
import type { ClientMessage } from '../../src/multiplayer/protocol/ClientMessage';
import type { AuthorityResult } from '../../src/multiplayer/roomAuthorityModel/AuthorityResult';
import type { RoomState } from '../../src/multiplayer/roomAuthorityModel/RoomState';
import { createMemoryServerDataStore } from '../../src/state/serverDataStore/createMemoryServerDataStore';
import type { ServerDataStore } from '../../src/state/serverDataStore/ServerDataStore';
import { createSessionState } from '../../src/state/session/createSessionState';
import { profileTokenAuth } from '../../src/state/serverDataStore/profileTokenAuth';

// Every test owns a realtime server on an ephemeral port plus fresh browser contexts,
// so tests are isolation-safe across parallel workers (#88).
test.describe.configure({ mode: 'parallel' });

let realtimeServer: CasinoServer | undefined;

test.beforeEach(({ context: _context }, testInfo) => {
  test.skip(testInfo.project.name !== 'laptop', 'The multi-browser scenarios create their own browser contexts.');
});

test.afterEach(async () => {
  await closeRealtimeServer();
});

test('multiplayer room lobby supports create, join, seat choice, spectate, leave, reconnect, and Blackjack table play', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const { profileAuthByName, wsUrl } = await startRealtimeServer(['Alice', 'Bob', 'Sue']);
  const contexts: BrowserContext[] = [];
  const openPlayer = async (name: string): Promise<Page> => {
    const context = await newPlayerContext(browser, wsUrl, profileAuthByName.get(name));
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

    await openHudOverflow(players[1]);
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
      .poll(async () => (await host.locator('.blackjack-table-seat.active').count()) === 1 || (await host.locator('#blackjackNewBtn').isEnabled()), {
        timeout: 10_000,
      })
      .toBe(true);
  } finally {
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  }
});

test('reconnected Beat the House clients return home when a restarted server has no active room', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const { dataStore, profileAuthByName } = seedDataStore(['Restart Alice', 'Restart Bob']);
  const wsUrl = await startRealtimeServerWithStore(dataStore);
  const restartPort = Number(new URL(wsUrl).port);
  const aliceContext = await newPlayerContext(browser, wsUrl, profileAuthByName.get('Restart Alice'));
  const bobContext = await newPlayerContext(browser, wsUrl, profileAuthByName.get('Restart Bob'));
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
  const { dataStore, profileAuthByName } = seedDataStore(['Server Alice', 'Server Bob']);
  const aliceProfile = dataStore.snapshot().profileState.profiles.find((profile) => profile.name === 'Server Alice');
  if (!aliceProfile) {
    throw new Error('Expected seeded Alice profile.');
  }
  dataStore.saveSession(createSessionState(aliceProfile.id, { activeGame: 'blackjack', showingGameLobby: false }));
  const wsUrl = await startRealtimeServerWithStore(dataStore);
  const bobContext = await newPlayerContext(browser, wsUrl, profileAuthByName.get('Server Bob'));
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

    await openHudOverflow(bob);
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
  test.setTimeout(150_000);
  const { profileAuthByName, wsUrl } = await startRealtimeServer(['Restore Alice', 'Restore Bob']);
  const aliceContext = await newPlayerContext(browser, wsUrl, profileAuthByName.get('Restore Alice'));
  const bobContext = await newPlayerContext(browser, wsUrl, profileAuthByName.get('Restore Bob'));
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

test('Beat the House multiplayer waits for player readiness before deal and next round', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const { profileAuthByName, wsUrl } = await startRealtimeServer(['Ready Alice', 'Ready Bob']);
  const aliceContext = await newPlayerContext(browser, wsUrl, profileAuthByName.get('Ready Alice'));
  const bobContext = await newPlayerContext(browser, wsUrl, profileAuthByName.get('Ready Bob'));
  try {
    const alice = await newPlayerPage(aliceContext, baseURL, 'Ready Alice');
    const bob = await newPlayerPage(bobContext, baseURL, 'Ready Bob');

    await alice.locator('[data-lobby-game="beat-the-house"]').click();
    await alice.locator('#roomNameInput').fill('Ready Flow Room');
    await alice.getByRole('button', { name: 'Create Room' }).click();
    await expect(alice.locator('#tableHost')).toBeVisible();
    await claimRoomSeat(alice, 'Left');

    await bob.locator('[data-lobby-game="beat-the-house"]').click();
    await bob.getByRole('button', { name: 'Join Room' }).first().click();
    await expect(bob.locator('#tableHost')).toBeVisible();
    await claimRoomSeat(bob, 'Centre');
    await expect(alice.locator('#roomSeats')).toContainText('Centre: Ready Bob', { timeout: 10_000 });

    await alice.getByLabel('£25 chip').click();
    await dropChipPercent(alice, 19.25, 70.55, 25);
    await expect.poll(async () => (await parsedDataset(alice, 'activeMainBets')).includes('left'), { timeout: 10_000 }).toBe(true);

    await alice.locator('#dealBtn').click();
    await expect(alice.locator('#dealBtn')).toBeHidden();
    await expect(bob.locator('#dealBtn')).toBeVisible();

    await bob.locator('#dealBtn').click();
    await expect(alice.locator('#chipRail')).toBeHidden({ timeout: 10_000 });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (await alice.locator('#nextBtn').isVisible()) {
        break;
      }
      if (await alice.locator('#stickBtn').isEnabled()) {
        await alice.locator('#stickBtn').click();
      } else {
        await alice.waitForTimeout(250);
      }
    }
    await expect(alice.locator('#nextBtn')).toBeVisible({ timeout: 10_000 });

    await alice.locator('#nextBtn').click();
    await expect(alice.locator('#nextBtn')).toBeHidden();
    await expect(bob.locator('#nextBtn')).toBeVisible();
    await bob.locator('#nextBtn').click();
    await expect(alice.locator('#chipRail')).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => alice.locator('#tableHost').evaluate((element) => element.dataset.settlementVisible)).toBe('false');
  } finally {
    await aliceContext.close().catch(() => undefined);
    await bobContext.close().catch(() => undefined);
  }
});

const beatActionDockSeatScenarios = [
  { seatLabel: 'Left', activeMainBet: 'left', chipXPercent: 19.25 },
  { seatLabel: 'Right', activeMainBet: 'right', chipXPercent: 80.85 },
] as const;

for (const scenario of beatActionDockSeatScenarios) {
  test(`Beat the House room action dock follows the ${scenario.activeMainBet} seat through ready, play, and rebet states`, async ({ browser, baseURL }) => {
    test.setTimeout(150_000);
    const playerName = `${scenario.seatLabel} Dock QA`;
    const { profileAuthByName, wsUrl } = await startRealtimeServer([playerName]);
    const context = await newPlayerContext(browser, wsUrl, profileAuthByName.get(playerName));
    try {
      const page = await newPlayerPage(context, baseURL, playerName);
      await page.locator('[data-lobby-game="beat-the-house"]').click();
      await page.locator('#roomNameInput').fill(`${scenario.seatLabel} Dock Room`);
      await page.getByRole('button', { name: 'Create Room' }).click();
      await expect(page.locator('#tableHost')).toBeVisible();
      await claimRoomSeat(page, scenario.seatLabel);

      await page.getByLabel('£25 chip').click();
      await dropChipPercent(page, scenario.chipXPercent, 70.55, 25);
      await expect.poll(async () => (await parsedDataset(page, 'activeMainBets')).includes(scenario.activeMainBet), { timeout: 10_000 }).toBe(true);
      await expectActionDockAnchoredToMineSeat(page, '#dealBtn');
      await expectActionDockAnchoredToMineSeat(page, '#clearBtn');

      await page.locator('#dealBtn').click();
      await expect(page.locator('#chipRail')).toBeHidden({ timeout: 10_000 });
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (await page.locator('#nextBtn').isVisible()) {
          break;
        }
        if (await page.locator('#stickBtn').isEnabled()) {
          await expectActionDockAnchoredToMineSeat(page, '#stickBtn');
          await page.locator('#stickBtn').click();
        } else {
          await page.waitForTimeout(250);
        }
      }

      await expect(page.locator('#nextBtn')).toBeVisible({ timeout: 10_000 });
      await page.locator('#nextBtn').click();
      await expect(page.locator('#chipRail')).toBeVisible({ timeout: 10_000 });
      await expectActionDockAnchoredToMineSeat(page, '#rebetBtn');
    } finally {
      await context.close().catch(() => undefined);
    }
  });
}

test('Beat the House table keeps per-hand popups, side-bet labels, deal order, and cleanup stable', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const { profileAuthByName, wsUrl } = await startRealtimeServer(['Beat QA']);
  const context = await newPlayerContext(browser, wsUrl, profileAuthByName.get('Beat QA'));
  try {
    const page = await newPlayerPage(context, baseURL, 'Beat QA');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-lobby-game="beat-the-house"]').click();
    await page.locator('#roomNameInput').fill('Popup QA');
    await page.getByRole('button', { name: 'Create Room' }).click();
    await expect(page.locator('#tableHost')).toBeVisible();
    await expect(page.locator('#tableHost canvas')).toBeVisible();
    await expect.poll(async () => Number(await page.locator('#tableHost').evaluate((element) => element.dataset.dealerCardCount ?? '0'))).toBe(0);
    await expect(page.locator('#chipRail')).toBeHidden();
    await claimRoomSeat(page, 'Left');
    await expect(page.locator('.seat-status-pill.mine')).toContainText('£1,000 (even)');
    await expect(page.locator('#chipRail')).toBeVisible();

    await page.getByLabel('£25 chip').click();
    await expect(page.getByLabel('£25 chip')).toHaveClass(/selected/);
    await dropChipPercent(page, 19.25, 70.55, 25);
    await expect(page.locator('.seat-status-pill.mine')).toContainText('£975 (-£25)');
    await expect.poll(async () => (await parsedDataset(page, 'activeMainBets')).includes('left')).toBe(true);
    await dropChipPercent(page, 26.25, 71.6, 25);
    await expect(page.locator('.seat-status-pill.mine')).toContainText('£950 (-£50)');
    await expect.poll(async () => (await parsedDataset(page, 'dealerTipSeats')).includes('left')).toBe(true);
    await dropChipPercent(page, 29.7, 44.2, 25);
    await dropChipPercent(page, 30.4, 45.0, 25);
    await dropChipPercent(page, 28.9, 43.8, 25);
    await expect.poll(() => tableAmount(page)).toBeGreaterThan(50);
    await page.locator('#dealBtn').click();

    await expect
      .poll(() => parsedDataset(page, 'cardAnimationOrders'))
      .toEqual(
        expect.arrayContaining([
          ['player-left-0', 0],
          ['dealer-hole', 1],
        ]),
      );
    await expect
      .poll(async () => Number(await page.locator('#tableHost').evaluate((element) => element.dataset.dealerCardCount ?? '0')))
      .toBeGreaterThanOrEqual(1);

    const animationOrdersBeforePanel = await parsedDataset(page, 'cardAnimationOrders');
    await openHudSection(page, 'admin');
    await expect.poll(() => parsedDataset(page, 'cardAnimationOrders')).toEqual(animationOrdersBeforePanel);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (await page.locator('#nextBtn').isEnabled()) {
        break;
      }
      if (await page.locator('#stickBtn').isEnabled()) {
        await expect(page.locator('#connectionOverlay')).toBeHidden({ timeout: 10_000 });
        await page.locator('#stickBtn').click();
      } else {
        await page.waitForTimeout(250);
      }
    }

    await expect(page.locator('#nextBtn')).toBeEnabled({ timeout: 10_000 });
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.settlementVisible), { timeout: 10_000 }).toBe('true');
    await openHudSection(page, 'admin');
    await page.locator('#layoutOverlayBtn').click();
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.settlementVisible)).toBe('true');

    await expect
      .poll(async () => {
        const settlementHandCount = Number(await page.locator('#tableHost').evaluate((element) => element.dataset.settlementHandCount ?? '0'));
        const settlementResults = await parsedDataset(page, 'settlementResults');
        const sideBetLabels = await parsedDataset(page, 'sideBetLabels');
        return {
          hasDealerSevens: sideBetLabels.some((label) => String(label).includes('Dealer Sevens')),
          hasHand: settlementHandCount >= 1,
          hasResult: settlementResults.some(
            (result) => String(result).includes(':win:') || String(result).includes(':lose:') || String(result).includes(':push:'),
          ),
        };
      })
      .toEqual({ hasDealerSevens: true, hasHand: true, hasResult: true });

    await page.locator('#nextBtn').click();
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.settlementVisible)).toBe('false');
    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.dealerCardCount)).toBe('0');
    await expect.poll(async () => (await parsedDataset(page, 'dealerTipSeats')).length).toBe(0);
    await expect.poll(async () => (await parsedDataset(page, 'dealerThanksRewards')).length).toBe(0);
    await expect(page.locator('#chipRail')).toBeVisible();

    await dropChipPercent(page, 19.25, 70.55, 25);
    await dropChipPercent(page, 29.7, 44.2, 25);
    await page.locator('#dealBtn').click();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (await page.locator('#nextBtn').isEnabled()) {
        break;
      }
      if (await page.locator('#stickBtn').isEnabled()) {
        await expect(page.locator('#connectionOverlay')).toBeHidden({ timeout: 10_000 });
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

test('Beat the House win popup includes House Advance repayment from authoritative settlement data', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const { dataStore, profileAuthByName } = seedDataStore(['Advance Popup QA']);
  const profileAuth = profileAuthByName.get('Advance Popup QA');
  if (!profileAuth) {
    throw new Error('Expected seeded House Advance profile auth.');
  }
  dataStore.setProfileBankroll(profileAuth.profileId, 0);
  dataStore.acceptHouseAdvance(profileAuth.profileId);
  const authority = new RiggedBeatRoundAuthority(dataStore, [
    { rank: 'A', suit: 'spades' },
    { rank: 'A', suit: 'hearts' },
  ]);
  const wsUrl = await startRealtimeServerWithStore(dataStore, 0, authority);
  const context = await newPlayerContext(browser, wsUrl, profileAuth);
  try {
    const page = await newPlayerPage(context, baseURL, 'Advance Popup QA');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('#houseAdvancePill')).toContainText('House Advance owed: £100 · 1/3 active');
    await page.locator('[data-lobby-game="beat-the-house"]').click();
    await page.locator('#roomNameInput').fill('Advance Popup Room');
    await page.getByRole('button', { name: 'Create Room' }).click();
    await expect(page.locator('#tableHost')).toBeVisible();
    await claimRoomSeat(page, 'Left');

    await page.getByLabel('£25 chip').click();
    await dropChipPercent(page, 19.25, 70.55, 25);
    await expect.poll(async () => (await parsedDataset(page, 'activeMainBets')).includes('left')).toBe(true);
    await page.locator('#dealBtn').click();

    await expect.poll(() => page.locator('#tableHost').evaluate((element) => element.dataset.settlementVisible), { timeout: 10_000 }).toBe('true');
    await expect
      .poll(async () => flatPopupLines(page))
      .toEqual(expect.arrayContaining(['Main WIN +£25', 'Side bets NONE +£0', 'Gross WIN +£25', 'House Advance payment -£2', 'Net WIN +£23']));
    await openHudSection(page, 'stats');
    await expect(page.locator('#auditLog')).toContainText('House Advance repayment withheld from beat-the-house net winnings.');
    await expect(page.locator('#auditLog')).toContainText('Withheld £2; owed £98.');
  } finally {
    await context.close().catch(() => undefined);
  }
});

test('multiplayer Slots exposes shared readiness, spin result, spectating, and no duplicate settlement from repeated spin attempts', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const { profileAuthByName, wsUrl } = await startRealtimeServer(['Slots Alice', 'Slots Bob', 'Slots Watcher']);
  const contexts: BrowserContext[] = [];
  const openPlayer = async (name: string): Promise<Page> => {
    const context = await newPlayerContext(browser, wsUrl, profileAuthByName.get(name));
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

type SeededProfileAuth = {
  readonly profileId: string;
  readonly profileToken: string;
};

type SeededRealtimeServer = {
  readonly profileAuthByName: ReadonlyMap<string, SeededProfileAuth>;
  readonly wsUrl: string;
};

type SeededDataStore = {
  readonly dataStore: ServerDataStore;
  readonly profileAuthByName: ReadonlyMap<string, SeededProfileAuth>;
};

type ElementBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const actionDockSeatCenterTolerancePx = 36;
const profileTokensStorageKey = 'casino_warehouse_profile_tokens';

const startRealtimeServer = async (profileNames: readonly string[]): Promise<SeededRealtimeServer> => {
  const { dataStore, profileAuthByName } = seedDataStore(profileNames);
  return { profileAuthByName, wsUrl: await startRealtimeServerWithStore(dataStore) };
};

const seedDataStore = (profileNames: readonly string[]): SeededDataStore => {
  const dataStore = createMemoryServerDataStore();
  const profileAuthByName = new Map<string, SeededProfileAuth>();
  for (const profileName of profileNames) {
    const snapshot = dataStore.createProfile(profileName);
    const profile = snapshot.profileState.profiles.find((candidate) => candidate.name === profileName);
    if (!profile) {
      throw new Error(`Expected seeded profile ${profileName}.`);
    }
    const profileToken = profileTokenAuth.createToken();
    dataStore.setProfileTokenHash(profile.id, profileTokenAuth.hash(profile.id, profileToken));
    profileAuthByName.set(profileName, { profileId: profile.id, profileToken });
  }
  return { dataStore, profileAuthByName };
};

const startRealtimeServerWithStore = async (dataStore: ServerDataStore, port = 0, authority?: CasinoRoomAuthority): Promise<string> => {
  realtimeServer = createCasinoServer({ dataStore, authority, heartbeatTimeoutMs: 300_000 });
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

const newPlayerContext = async (browser: Browser, wsUrl: string, profileAuth?: SeededProfileAuth): Promise<BrowserContext> => {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ auth, profileTokensKey, url }) => {
      if (!localStorage.getItem('casino_e2e_context_ready')) {
        localStorage.clear();
        localStorage.setItem('casino_e2e_context_ready', 'true');
      }
      localStorage.setItem('casino_realtime_url', url);
      if (auth) {
        localStorage.setItem(profileTokensKey, JSON.stringify({ [auth.profileId]: auth.profileToken }));
      }
    },
    { auth: profileAuth, profileTokensKey: profileTokensStorageKey, url: wsUrl },
  );
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
  await expect(row.locator('[data-profile-select]')).toBeEnabled();
  await row.locator('[data-profile-select]').check();
  await page.getByRole('button', { name: 'Start Profile Session' }).click();
};

const waitForRealtime = async (page: Page): Promise<void> => {
  await expect(page.locator('#connectionOverlay')).toBeHidden({ timeout: 15_000 });
};

type HudSection = 'admin' | 'room' | 'stats';

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

const claimRoomSeat = async (page: Page, seatLabel: string): Promise<void> => {
  await openHudSection(page, 'room');
  const seatButton = page.locator('#roomSeats').getByRole('button', { name: `${seatLabel}: open` });
  await expect(seatButton).toBeVisible();
  await seatButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(seatButton).toBeHidden({ timeout: 10_000 });
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

const parsedDataset = async (page: Page, key: string): Promise<readonly JsonValue[]> =>
  page.locator('#tableHost').evaluate((element, datasetKey): readonly JsonValue[] => {
    const parsed = JSON.parse(element.dataset[datasetKey] ?? '[]') as JsonValue;
    return Array.isArray(parsed) ? parsed : [];
  }, key);

const expectActionDockAnchoredToMineSeat = async (page: Page, visibleActionSelector: string): Promise<void> => {
  await expect(page.locator(visibleActionSelector)).toBeVisible();
  await expect(page.locator('#actionDock')).toHaveAttribute('data-beat-seat', /^(left|centre|right)$/);
  const beatSeat = await page.locator('#actionDock').getAttribute('data-beat-seat');
  const actionDock = await boundingBox(page.locator('#actionDock'));
  const mineSeat = await boundingBox(page.locator('.seat-status-pill.mine'));
  const tableHost = await boundingBox(page.locator('#tableHost'));
  const moneyPill = await boundingBox(page.locator('#moneyPill'));
  if (beatSeat === 'centre') {
    expect(Math.abs(centerX(actionDock) - centerX(mineSeat))).toBeLessThanOrEqual(actionDockSeatCenterTolerancePx);
  } else if (beatSeat === 'left') {
    expect(centerX(actionDock)).toBeGreaterThan(centerX(mineSeat));
    expect(centerX(actionDock)).toBeLessThan(centerX(tableHost));
  } else {
    expect(centerX(actionDock)).toBeLessThan(centerX(mineSeat));
    expect(centerX(actionDock)).toBeGreaterThan(centerX(tableHost));
  }
  expectBoxesNotToOverlap(actionDock, mineSeat);
  expectBoxesNotToOverlap(actionDock, moneyPill);
  if (await page.locator('#chipRail').isVisible()) {
    expectBoxesNotToOverlap(actionDock, await boundingBox(page.locator('#chipRail')));
  }
  await expectNoHorizontalOverflow(page.locator('.game-shell'));
};

const flatPopupLines = async (page: Page): Promise<string[]> =>
  (await parsedDataset(page, 'settlementPopupLines')).flatMap((popup) => (Array.isArray(popup) ? popup.map(String) : [String(popup)]));

const tableAmount = async (page: Page): Promise<number> => {
  const text = await page.locator('#onTable').textContent();
  return Number((text ?? '').replace(/[£,]/g, '')) || 0;
};

const transactionCount = async (page: Page, text: string): Promise<number> =>
  page.evaluate(async (needle) => {
    const url = localStorage.getItem('casino_realtime_url') ?? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const store = await new Promise<{ readonly profiles?: readonly { readonly transactions?: readonly { readonly description?: string }[] }[] }>(
      (resolve, reject) => {
        const socket = new WebSocket(url);
        const timer = window.setTimeout(() => {
          socket.close();
          reject(new Error('Timed out reading server data.'));
        }, 5_000);
        socket.addEventListener('open', () => {
          socket.send(JSON.stringify({ type: 'request-data' }));
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
      },
    );
    return (store.profiles ?? []).flatMap((profile) => profile.transactions ?? []).filter((transaction) => transaction.description?.includes(needle)).length;
  }, text);

const boundingBox = async (locator: Locator): Promise<ElementBox> => {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Expected locator to have a bounding box.');
  }
  return box;
};

const centerX = (box: ElementBox): number => box.x + box.width / 2;

const expectBoxesNotToOverlap = (first: ElementBox, second: ElementBox): void => {
  expect(first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y).toBe(
    false,
  );
};

const expectNoHorizontalOverflow = async (locator: Locator): Promise<void> => {
  await expect(locator).toBeVisible();
  const overflow = await locator.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
};

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

class RiggedBeatRoundAuthority extends RoomAuthority {
  public constructor(
    dataStore: ServerDataStore,
    private readonly dealOrder: readonly Card[],
  ) {
    super(dataStore);
  }

  public override handle(connectionId: string, message: ClientMessage): AuthorityResult {
    if (message.type !== 'start-round') {
      return super.handle(connectionId, message);
    }
    const room = this.roomForConnection(connectionId);
    if (room?.model.kind !== 'beat-the-house') {
      return super.handle(connectionId, message);
    }
    const before = room.model.game.snapshot();
    const snapshot = room.model.game.deal(rigDeck([...this.dealOrder]));
    room.lastBeatEvents = snapshot.lastEvents;
    const settlements = snapshot.phase === 'roundOver' && before.phase !== 'roundOver' ? this.settleBeat(room, snapshot) : [];
    return this.broadcast(room, settlements);
  }

  private roomForConnection(connectionId: string): RoomState | undefined {
    return [...this.rooms.values()].find((room) => room.connectionToMember.has(connectionId));
  }
}
