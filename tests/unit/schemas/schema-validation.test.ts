import { describe, expect, it } from 'vitest';
import { sanitizeAudioSettings } from '../../../src/audio/casinoAudio/sanitizeAudioSettings';
import { gameCatalog } from '../../../src/game/catalog/gameCatalog';
import { gameCatalogSchema } from '../../../src/schemas/casinoSchemas/gameCatalogSchema';
import { slotThemeSchema } from '../../../src/schemas/casinoSchemas/slotThemeSchema';
import { loadProfileStore } from '../../../src/state/profiles/loadProfileStore';
import { parseProfileStoreJson } from '../../../src/state/profiles/parseProfileStoreJson';
import type { StorageLike } from '../../../src/state/profiles/StorageLike';
import { parseClientMessage } from '../../../src/multiplayer/protocol/parseClientMessage';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('Zod-backed runtime validation', () => {
  it('normalizes valid realtime room requests and rejects malformed actions clearly', () => {
    const created = parseClientMessage({
      version: 1,
      type: 'create-room',
      gameId: 'blackjack',
      roomName: ` Late   Table ${'x'.repeat(80)}`,
      maxPlayers: 5,
      profileId: 'profile-1',
      profileName: ' Alice   Dealer ',
      bankroll: 1200,
    });

    expect(created).toMatchObject({
      ok: true,
      message: {
        type: 'create-room',
        roomName: `Late Table ${'x'.repeat(37)}`,
        maxPlayers: 5,
        profileName: 'Alice Dealer',
        bankroll: 1200,
      },
    });

    expect(parseClientMessage({ version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 0 })).toEqual({
      ok: false,
      error: 'Amount must be greater than zero.',
    });
  });

  it('validates legacy session room restore targets without trusting malformed rooms', () => {
    const saved = parseClientMessage({
      version: 1,
      type: 'save-session',
      session: {
        profileIds: ['profile-1'],
        selectedPlayerIndex: 0,
        activeGame: 'beat-the-house',
        showingGameLobby: true,
        wagerLimit: 0,
        wagered: 0,
        gameSnapshots: {},
        room: {
          roomId: 'room42',
          gameId: 'blackjack',
          role: 'spectator',
        },
      },
    });

    expect(saved).toMatchObject({
      ok: true,
      message: {
        type: 'save-session',
        session: {
          room: { roomId: 'ROOM42', gameId: 'blackjack', role: 'spectator' },
        },
      },
    });

    expect(
      parseClientMessage({
        version: 1,
        type: 'save-session',
        session: {
          profileIds: ['profile-1'],
          selectedPlayerIndex: 0,
          activeGame: 'beat-the-house',
          showingGameLobby: true,
          wagerLimit: 0,
          wagered: 0,
          gameSnapshots: {},
          room: {
            roomId: 'room42',
            gameId: 'blackjack',
            role: 'dealer',
          },
        },
      }),
    ).toMatchObject({ ok: false });
  });

  it('recovers corrupted profile saves and explains bad imports', () => {
    const storage = new MemoryStorage();
    storage.setItem('casino_warehouse_profiles_v1', '{"version":1,"profiles":[{"id":""}]}');

    const loaded = loadProfileStore(storage);
    expect(loaded.recovered).toBe(true);
    expect(loaded.error).toContain('Profile record is invalid');

    expect(() => parseProfileStoreJson('{"version":2,"profiles":[]}')).toThrow(/Save data is not a casino profile store/);
  });

  it('validates settings and game/slot configuration at runtime boundaries', () => {
    expect(sanitizeAudioSettings({ masterVolume: 99, musicVolume: 0.4 }).masterVolume).toBe(1);
    expect(gameCatalogSchema.parse(gameCatalog)).toHaveLength(gameCatalog.length);
    expect(() => slotThemeSchema.parse({ id: 'bad', title: 'Bad', accent: 'purple', reelStrip: [], payouts: {}, jackpots: {}, bonus: {} })).toThrow();
  });
});
