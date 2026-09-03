import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { sanitizeAudioSettings } from '../../../src/audio/casinoAudio/sanitizeAudioSettings';
import { gameCatalog } from '../../../src/game/catalog/gameCatalog';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { bankrollTransactionSchema } from '../../../src/schemas/casinoSchemas/bankrollTransactionSchema';
import { casinoProfileSchema } from '../../../src/schemas/casinoSchemas/casinoProfileSchema';
import { beatTheHouseShoeSaveStateSchema } from '../../../src/schemas/casinoSchemas/beatTheHouseShoeSaveStateSchema';
import { gameCatalogSchema } from '../../../src/schemas/casinoSchemas/gameCatalogSchema';
import { gameSnapshotSchema } from '../../../src/schemas/casinoSchemas/gameSnapshotSchema';
import { profileNameSchema } from '../../../src/schemas/casinoSchemas/profileNameSchema';
import { roomNameSchema } from '../../../src/schemas/casinoSchemas/roomNameSchema';
import { slotThemeSchema } from '../../../src/schemas/casinoSchemas/slotThemeSchema';
import { transactionTypeSchema } from '../../../src/schemas/casinoSchemas/transactionTypeSchema';
import { audioSettingsSchema } from '../../../src/schemas/casinoSchemas/audioSettingsSchema';
import { zodErrorSummary } from '../../../src/schemas/casinoSchemas/zodErrorSummary';
import { parseCasinoSaveState } from '../../../src/state/profiles/parseCasinoSaveState';
import { loadProfileStore } from '../../../src/state/profiles/loadProfileStore';
import { parseProfileStoreJson } from '../../../src/state/profiles/parseProfileStoreJson';
import type { StorageLike } from '../../../src/state/profiles/StorageLike';
import { parseClientMessage } from '../../../src/multiplayer/protocol/parseClientMessage';
import { parseSessionState } from '../../../src/state/session/parseSessionState';

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

describe('Zod-backed runtime validation', () => {
  it('normalizes valid realtime room requests and rejects malformed actions clearly', () => {
    const created = parseClientMessage({
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

    expect(parseClientMessage({ type: 'place-chip', seatId: 'left', betType: 'main', amount: 0 })).toEqual({
      ok: false,
      error: 'Amount must be greater than zero.',
    });
    expect(parseClientMessage({ type: 'place-tip', seatId: 'left', amount: 5 })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'place-tip', seatId: 'left', amount: 0 })).toEqual({
      ok: false,
      error: 'Amount must be greater than zero.',
    });
  });

  it('validates session room restore targets without trusting malformed rooms', () => {
    const saved = parseClientMessage({
      type: 'save-session',
      session: {
        profileId: 'profile-1',
        activeGame: 'beat-the-house',
        showingGameLobby: true,
        wagerLimit: 0,
        wagered: 0,
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
        type: 'save-session',
        session: {
          profileId: 'profile-1',
          activeGame: 'beat-the-house',
          showingGameLobby: true,
          wagerLimit: 0,
          wagered: 0,
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
    storage.setItem('casino_warehouse_profiles', '{"profiles":[{"id":""}]}');

    const loaded = loadProfileStore(storage);
    expect(loaded.recovered).toBe(true);
    expect(loaded.error).toContain('Profile id is required');
    expect(storage.getItem('casino_warehouse_profiles')).toBeNull();

    expect(parseProfileStoreJson('{"version":2,"profiles":[]}')).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('Unrecognized key: "version"') },
    });
  });

  it('rejects obsolete version fields at every boundary', () => {
    expect(parseClientMessage({ version: 2, type: 'request-data' })).toMatchObject({ ok: false });
    expect(parseProfileStoreJson('{"version":2,"profiles":[]}')).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('Unrecognized key: "version"') },
    });
    expect(parseSessionState({ version: 1, profileIds: [] })).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('Session data is not valid') },
    });
  });

  it('validates settings and game/slot configuration at runtime boundaries', () => {
    expect(sanitizeAudioSettings({ masterVolume: 99, musicVolume: 0.4 }).masterVolume).toBe(1);
    expect(audioSettingsSchema.safeParse({ unexpected: true }).success).toBe(false);
    expect(gameCatalogSchema.parse(gameCatalog)).toHaveLength(gameCatalog.length);
    expect(() => slotThemeSchema.parse({ id: 'bad', title: 'Bad', accent: 'purple', reelStrip: [], payouts: {}, jackpots: {}, bonus: {} })).toThrow();
  });

  it('validates the complete private shoe and public snapshot contracts', () => {
    const snapshot = new BeatTheHouseGame({ initialBankroll: 100 }).snapshot();
    const savedShoe = new BeatTheHouseGame({ initialBankroll: 100 }).saveState().shoe;

    expect(gameSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(gameSnapshotSchema.safeParse({ ...snapshot, dealer: { ...snapshot.dealer, holeCard: { rank: 'A', suit: 'spades' } } }).success).toBe(false);
    expect(
      gameSnapshotSchema.safeParse({
        ...snapshot,
        lastEvents: [
          { type: 'shoe-shuffled', message: 'A fresh six-deck shoe is ready.' },
          { type: 'shoe-cut-reached', message: 'The shoe cut card has been reached.' },
        ],
      }).success,
    ).toBe(true);
    expect(gameSnapshotSchema.safeParse({ ...snapshot, shoe: { ...snapshot.shoe, cutThresholdCardsDealt: 219 } }).success).toBe(false);
    expect(beatTheHouseShoeSaveStateSchema.safeParse(savedShoe).success).toBe(true);
    expect(beatTheHouseShoeSaveStateSchema.safeParse({ ...savedShoe, deck: [] }).success).toBe(false);
    expect(beatTheHouseShoeSaveStateSchema.safeParse({ ...savedShoe, cutThresholdCardsDealt: 1 }).success).toBe(false);
  });

  it('preserves finite heartbeat timestamps without applying credit normalization', () => {
    expect(parseClientMessage({ type: 'heartbeat-ack', sentAt: 1.5 })).toEqual({
      ok: true,
      message: { type: 'heartbeat-ack', sentAt: 1.5 },
    });
  });

  it('rejects incomplete persisted records and invalid parser envelopes directly', () => {
    expect(() => casinoProfileSchema.parse({ id: 'profile-a', name: 'Alice' })).toThrow();
    expect(() => bankrollTransactionSchema.parse({ id: 'tx-a', gameId: 'admin', type: 'invalid', amount: 1 })).toThrow();
    expect(profileNameSchema.parse('   ')).toBe('Player');
    expect(transactionTypeSchema.parse('correction')).toBe('correction');
    expect(transactionTypeSchema.parse('dealer_tip')).toBe('dealer_tip');
    expect(transactionTypeSchema.parse('dealer_thanks')).toBe('dealer_thanks');
    expect(transactionTypeSchema.parse('house_advance_repayment')).toBe('house_advance_repayment');
    expect(roomNameSchema.parse('  Late    Table  ')).toBe('Late Table');
    expect(roomNameSchema.parse(undefined)).toBeUndefined();
    expect(zodErrorSummary(new ZodError([]))).toBe('Payload is invalid.');
    expect(parseCasinoSaveState(null)).toMatchObject({
      ok: false,
      error: { message: 'Save data is not a casino profile store: Invalid input: expected object, received null' },
    });
    expect(parseSessionState(null)).toMatchObject({
      ok: false,
      error: { message: 'Session data is not valid: Invalid input: expected object, received null' },
    });
  });
});
