import { describe, expect, it, vi } from 'vitest';
import { BlackjackGame } from '../../../src/game/blackjack/BlackjackGame';
import { slotThemes } from '../../../src/game/catalog/slotThemes';
import type { Card } from '../../../src/game/cards/Card';
import { rigDeck } from '../../../src/game/cards/rigDeck';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { SlotsGame } from '../../../src/game/slots/SlotsGame';
import { createPlayerFromProfile } from '../../../src/app/state/casinoPlayer/createPlayerFromProfile';
import { createSessionState } from '../../../src/state/session/createSessionState';
import { loadSessionState } from '../../../src/state/session/loadSessionState';
import { parseSessionState } from '../../../src/state/session/parseSessionState';
import { saveSessionState } from '../../../src/state/session/saveSessionState';
import { createProfile } from '../../../src/state/profiles/createProfile';
import type { StorageLike } from '../../../src/state/profiles/StorageLike';
import { testProfileId, testRoomId } from '../schemas/testIds';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public clear(): void {
    this.values.clear();
  }
}

describe('session store', () => {
  it('persists the current single-profile session separately from profile records', () => {
    const storage = new MemoryStorage();
    const session = createSessionState(
      testProfileId('profile-a'),
      {
        activeGame: 'blackjack',
        showingGameLobby: false,
        wagerLimit: 500,
        wagered: 125,
        room: {
          roomId: testRoomId('abc123'),
          gameId: 'blackjack',
          role: 'player',
        },
        gameSnapshot: {
          blackjack: {
            phase: 'player',
            wager: 25,
            playerCards: [{ rank: 'K', suit: 'spades' }],
            dealerCards: [{ rank: '7', suit: 'hearts' }],
            dealerHoleHidden: true,
            insuranceWager: 0,
            splitHands: [],
            returned: 0,
            status: 'Player K.',
          },
          slots: {},
        },
      },
      new Date('2026-05-04T12:00:00Z'),
    );

    saveSessionState(storage, session);
    const loaded = loadSessionState(storage);

    expect(loaded.session).toEqual(session);
    expect(loaded.recovered).toBe(false);
  });

  it('stores one selected profile and clamps invalid wager values', () => {
    const session = createSessionState(testProfileId('a'), {
      wagerLimit: -1,
      wagered: Number.NaN,
    });

    expect(session.profileId).toBe('a');
    expect(session.wagerLimit).toBe(0);
    expect(session.wagered).toBe(0);
  });

  it('uses the profile bankroll instead of stale Beat the House session bankrolls', () => {
    const profile = createProfile({ profiles: [] }, 'Central Wallet', 467).profiles[0];
    if (!profile) {
      throw new Error('Missing profile.');
    }
    const staleSnapshot = new BeatTheHouseGame({ initialBankroll: 2169 }).saveState();

    const player = createPlayerFromProfile(profile, { beatTheHouse: staleSnapshot });

    expect(player.beatTheHouse.snapshot().bankroll).toBe(467);
  });

  it('restores saved Blackjack and slot snapshots for a profile session', () => {
    const profile = createProfile({ profiles: [] }, 'Saved Table', 700).profiles[0];
    if (!profile) {
      throw new Error('Missing profile.');
    }
    const blackjackSnapshot = new BlackjackGame().deal(25, rigDeck([card('10', 'spades'), card('9', 'hearts'), card('6', 'clubs'), card('8', 'diamonds')]));
    const slotTheme = slotThemes[0];
    if (!slotTheme) {
      throw new Error('Missing slotTheme.');
    }
    const slotSnapshot = new SlotsGame({ theme: slotTheme }).spin(10, [
      'lotus',
      'lotus',
      'lotus',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
    ]);

    const player = createPlayerFromProfile(profile, {
      blackjack: blackjackSnapshot,
      slots: { [slotTheme.id]: slotSnapshot },
    });

    expect(player.blackjack.snapshot()).toEqual(blackjackSnapshot);
    const slotGame = player.slots.get(slotTheme.id);
    if (!slotGame) {
      throw new Error('Missing slot game.');
    }
    expect(slotGame.snapshot()).toEqual(slotSnapshot);
  });

  it('recovers gracefully from corrupt session storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('casino_warehouse_session', '{ broken');

    const loaded = loadSessionState(storage);

    expect(loaded.session).toBeUndefined();
    expect(loaded.recovered).toBe(true);
    expect(loaded.error).toBeTruthy();
    expect(storage.getItem('casino_warehouse_session')).toBeNull();
  });

  it('keeps the recovery result when corrupt session storage cannot be removed', () => {
    const storage = new MemoryStorage();
    storage.setItem('casino_warehouse_session', '{ broken');
    vi.spyOn(storage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const loaded = loadSessionState(storage);

    expect(loaded.recovered).toBe(true);
    expect(loaded.session).toBeUndefined();
  });

  it('recovers when session storage access throws', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw Symbol('storage unavailable');
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    expect(loadSessionState(storage)).toMatchObject({ recovered: true, error: 'Unknown session-data error.' });
    expect(storage.removeItem).toHaveBeenCalledWith('casino_warehouse_session');
  });

  it('rejects invalid session fields and malformed nested snapshots', () => {
    const storage = new MemoryStorage();
    expect(loadSessionState(storage)).toEqual({ recovered: false });
    expect(
      parseSessionState({
        profileId: 'a',
        activeGame: 'not-real',
        showingGameLobby: false,
        wagerLimit: 0,
        wagered: 0,
        updatedAt: '2026-05-04T12:00:00Z',
      }),
    ).toMatchObject({ ok: false, error: { message: expect.stringContaining('Session data is not valid') } });
    expect(
      parseSessionState({
        profileId: 'a',
        activeGame: 'slots:thai-princess',
        showingGameLobby: false,
        wagerLimit: 200,
        wagered: 50,
        gameSnapshot: { slots: { 'thai-princess': { themeId: 'thai-princess' } } },
        updatedAt: '2026-05-04T12:00:00Z',
      }),
    ).toMatchObject({ ok: false, error: { message: expect.stringContaining('Session data is not valid') } });
  });

  it('rejects obsolete version fields instead of dispatching migrations', () => {
    expect(parseSessionState({ version: 2 })).toMatchObject({ ok: false, error: { message: expect.stringContaining('Session data is not valid') } });
    expect(parseSessionState({ profileIds: [] })).toMatchObject({ ok: false, error: { message: expect.stringContaining('Session data is not valid') } });
  });
});
