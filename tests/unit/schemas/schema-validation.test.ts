import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { sanitizeAudioSettings } from '../../../src/audio/casinoAudio/sanitizeAudioSettings';
import { gameCatalog } from '../../../src/game/catalog/gameCatalog';
import { bankrollTransactionSchema } from '../../../src/schemas/casinoSchemas/bankrollTransactionSchema';
import { casinoProfileSchema } from '../../../src/schemas/casinoSchemas/casinoProfileSchema';
import { gameCatalogSchema } from '../../../src/schemas/casinoSchemas/gameCatalogSchema';
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

    expect(() => parseProfileStoreJson('{"version":2,"profiles":[]}')).toThrow('Unrecognized key: "version"');
  });

  it('rejects obsolete version fields at every boundary', () => {
    expect(parseClientMessage({ version: 2, type: 'request-data' })).toMatchObject({ ok: false });
    expect(() => parseProfileStoreJson('{"version":2,"profiles":[]}')).toThrow('Unrecognized key: "version"');
    expect(() => parseSessionState({ version: 1, profileIds: [] })).toThrow('Session data is not valid');
  });

  it('validates settings and game/slot configuration at runtime boundaries', () => {
    expect(sanitizeAudioSettings({ masterVolume: 99, musicVolume: 0.4 }).masterVolume).toBe(1);
    expect(audioSettingsSchema.safeParse({ unexpected: true }).success).toBe(false);
    expect(gameCatalogSchema.parse(gameCatalog)).toHaveLength(gameCatalog.length);
    expect(() => slotThemeSchema.parse({ id: 'bad', title: 'Bad', accent: 'purple', reelStrip: [], payouts: {}, jackpots: {}, bonus: {} })).toThrow();
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
    expect(() => parseCasinoSaveState(null)).toThrow('Save data is not a casino profile store: Invalid input: expected object, received null');
    expect(() => parseSessionState(null)).toThrow('Session data is not valid: Invalid input: expected object, received null');
  });
});
