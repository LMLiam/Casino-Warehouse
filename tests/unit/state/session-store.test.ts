import { describe, expect, it } from 'vitest';
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

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('session store', () => {
  it('persists current multiplayer session separately from profile records', () => {
    const storage = new MemoryStorage();
    const session = createSessionState(
      ['profile-a', 'profile-b'],
      {
        activeGame: 'blackjack',
        selectedPlayerIndex: 1,
        showingGameLobby: false,
        wagerLimit: 500,
        wagered: 125,
        room: {
          roomId: 'abc123',
          gameId: 'blackjack',
          role: 'player',
        },
        gameSnapshots: {
          'profile-a': {
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
      },
      new Date('2026-05-04T12:00:00Z'),
    );

    saveSessionState(storage, session);
    const loaded = loadSessionState(storage);

    expect(loaded.session).toEqual(session);
    expect(loaded.recovered).toBe(false);
  });

  it('deduplicates selected profiles and clamps invalid wager values', () => {
    const session = createSessionState(['a', 'a', '', 'b'], {
      wagerLimit: -1,
      wagered: Number.NaN,
    });

    expect(session.profileIds).toEqual(['a', 'b']);
    expect(session.wagerLimit).toBe(0);
    expect(session.wagered).toBe(0);
  });

  it('uses the profile bankroll instead of stale Beat the House session bankrolls', () => {
    const profile = createProfile({ version: 1, profiles: [] }, 'Central Wallet', 467).profiles[0];
    const staleSnapshot = new BeatTheHouseGame({ initialBankroll: 2169 }).saveState();

    const player = createPlayerFromProfile(profile, { beatTheHouse: staleSnapshot });

    expect(player.beatTheHouse.snapshot().bankroll).toBe(467);
  });

  it('restores saved Blackjack and slot snapshots for a profile session', () => {
    const profile = createProfile({ version: 1, profiles: [] }, 'Saved Table', 700).profiles[0];
    const blackjackSnapshot = new BlackjackGame().deal(25, rigDeck([card('10', 'spades'), card('9', 'hearts'), card('6', 'clubs'), card('8', 'diamonds')]));
    const slotTheme = slotThemes[0];
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
    expect(player.slots[slotTheme.id].snapshot()).toEqual(slotSnapshot);
  });

  it('recovers gracefully from corrupt session storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('casino_warehouse_session_v1', '{ broken');

    const loaded = loadSessionState(storage);

    expect(loaded.session).toBeUndefined();
    expect(loaded.recovered).toBe(true);
    expect(loaded.error).toBeTruthy();
  });

  it('rejects unknown game ids', () => {
    const session = parseSessionState({
      version: 1,
      profileIds: ['a'],
      activeGame: 'not-real',
      selectedPlayerIndex: 0,
      showingGameLobby: false,
      wagerLimit: 0,
      wagered: 0,
      updatedAt: '2026-05-04T12:00:00Z',
    });

    expect(session.activeGame).toBe('beat-the-house');
  });

  it('handles missing and invalid session fields without destroying valid saves', () => {
    const storage = new MemoryStorage();
    expect(loadSessionState(storage)).toEqual({ recovered: false });
    const session = parseSessionState({
      version: 1,
      profileIds: ['a', 7, 'b'],
      selectedPlayerIndex: 4.7,
      activeGame: 'slots:thai-princess',
      showingGameLobby: '',
      wagerLimit: '200',
      wagered: '50',
      gameSnapshots: {
        a: { beatTheHouse: {}, blackjack: {}, slots: { 'thai-princess': { themeId: 'thai-princess' } } },
        bad: null,
      },
    });

    expect(session.profileIds).toEqual(['a', 'b']);
    expect(session.activeGame).toBe('slots:thai-princess');
    expect(session.selectedPlayerIndex).toBe(4);
    expect(
      parseSessionState({
        version: 1,
        profileIds: ['a'],
        room: { roomId: 'mixed42', gameId: 'blackjack', role: 'spectator', seatId: 'seat-2' },
      }).room,
    ).toEqual({ roomId: 'MIXED42', gameId: 'blackjack', role: 'spectator', seatId: 'seat-2' });
    expect(
      parseSessionState({
        version: 1,
        profileIds: ['a'],
        room: { roomId: 'mixed42', gameId: 'beat-the-house', role: 'player', seatId: 'centre' },
      }).room,
    ).toEqual({ roomId: 'MIXED42', gameId: 'beat-the-house', role: 'player', seatId: 'centre' });
    expect(
      parseSessionState({
        version: 1,
        profileIds: ['a'],
        room: { roomId: 'mixed42', gameId: 'blackjack', role: 'player', seatId: 'not-a-seat' },
      }).room,
    ).toEqual({ roomId: 'MIXED42', gameId: 'blackjack', role: 'player', seatId: undefined });
    expect(
      parseSessionState({
        version: 1,
        profileIds: ['a'],
        room: { roomId: '', gameId: 'blackjack', role: 'player' },
      }).room,
    ).toBeUndefined();
    expect(
      parseSessionState({
        version: 1,
        profileIds: ['a'],
        room: { roomId: 'room42', gameId: 'not-real', role: 'player' },
      }).room,
    ).toBeUndefined();
    expect(
      parseSessionState({
        version: 1,
        profileIds: ['a'],
        room: { roomId: 'room42', gameId: 'blackjack', role: 'dealer' },
      }).room,
    ).toBeUndefined();
    expect(session.gameSnapshots.a.slots?.['thai-princess']).toEqual({ themeId: 'thai-princess' });
  });

  it('rejects malformed and unsupported session-state migration inputs clearly', () => {
    expect(() => parseSessionState({ version: 1 })).toThrow('Session v1 data is not valid.');
    expect(() => parseSessionState({ version: 2, profileIds: [] })).toThrow('Session data version 2 is not supported.');
  });
});
