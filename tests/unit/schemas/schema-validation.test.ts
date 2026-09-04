import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { sanitizeAudioSettings } from '../../../src/audio/casinoAudio/sanitizeAudioSettings';
import { gameCatalog } from '../../../src/game/catalog/gameCatalog';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { beatTheHouseSettlementReceiptSchema } from '../../../src/schemas/casinoSchemas/beatTheHouseSettlementReceiptSchema';
import { bankrollTransactionSchema } from '../../../src/schemas/casinoSchemas/bankrollTransactionSchema';
import { casinoProfileSchema } from '../../../src/schemas/casinoSchemas/casinoProfileSchema';
import { beatTheHouseShoeSaveStateSchema } from '../../../src/schemas/casinoSchemas/beatTheHouseShoeSaveStateSchema';
import { gameCatalogSchema } from '../../../src/schemas/casinoSchemas/gameCatalogSchema';
import { gameSnapshotSchema } from '../../../src/schemas/casinoSchemas/gameSnapshotSchema';
import { beatTheHouseSettlementDataSchema } from '../../../src/schemas/protocol/beatTheHouseSettlementDataSchema';
import { serverMessageSchema } from '../../../src/schemas/protocol/serverMessageSchema';
import { profileNameSchema } from '../../../src/schemas/casinoSchemas/profileNameSchema';
import { roomNameSchema } from '../../../src/schemas/casinoSchemas/roomNameSchema';
import { slotThemeSchema } from '../../../src/schemas/casinoSchemas/slotThemeSchema';
import { transactionTypeSchema } from '../../../src/schemas/casinoSchemas/transactionTypeSchema';
import { audioSettingsSchema } from '../../../src/schemas/casinoSchemas/audioSettingsSchema';
import type { JsonValue } from '../../../src/schemas/casinoSchemas/JsonValue';
import { zodErrorSummary } from '../../../src/schemas/casinoSchemas/zodErrorSummary';
import { parseCasinoSaveState } from '../../../src/state/profiles/parseCasinoSaveState';
import { loadProfileStore } from '../../../src/state/profiles/loadProfileStore';
import { parseProfileStoreJson } from '../../../src/state/profiles/parseProfileStoreJson';
import type { StorageLike } from '../../../src/state/profiles/StorageLike';
import { decodeServerMessage } from '../../../src/multiplayer/protocol/decodeServerMessage';
import { parseClientMessage } from '../../../src/multiplayer/protocol/parseClientMessage';
import { parseSessionState } from '../../../src/state/session/parseSessionState';
import { profileStoreContractFixtures, serverMessageContractFixtures } from './schema-contract-fixtures';

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

  it('validates exact Beat the House settlement metadata and conservation', () => {
    const exact = {
      returnedHalfUnits: 5,
      profitHalfUnits: 3,
      halfChipBefore: 1,
      halfChipAfter: 0,
      wholeCreditsReleased: 3,
    };
    const settlement = {
      type: 'settlement',
      roomId: 'ROOM1',
      sessionId: 'SESSION1',
      settlements: [
        {
          id: 'settlement-1',
          kind: 'gameplay',
          profileId: 'profile-receipt',
          seatId: 'left',
          wagered: 1,
          returned: 2.5,
          profit: 1.5,
          beatTheHouse: exact,
        },
      ],
    };

    expect(beatTheHouseSettlementDataSchema.safeParse(exact).success).toBe(true);
    expect(serverMessageSchema.safeParse(settlement).success).toBe(true);
    expect(decodeServerMessage(JSON.stringify(settlement))).toEqual(settlement);

    const invalidExactValues = [
      { ...exact, returnedHalfUnits: -1 },
      { ...exact, returnedHalfUnits: 0.5 },
      { ...exact, profitHalfUnits: Number.MAX_SAFE_INTEGER + 1 },
      { ...exact, halfChipBefore: 2 },
      { ...exact, wholeCreditsReleased: -1 },
      { ...exact, extra: true },
    ];
    for (const value of invalidExactValues) {
      expect(beatTheHouseSettlementDataSchema.safeParse(value).success).toBe(false);
    }

    const invalidSettlements = [
      { ...settlement, settlements: [{ ...settlement.settlements[0], kind: 'dealer-thanks' }] },
      { ...settlement, settlements: [{ ...settlement.settlements[0], wagered: 1.5 }] },
      { ...settlement, settlements: [{ ...settlement.settlements[0], returned: 2 }] },
      { ...settlement, settlements: [{ ...settlement.settlements[0], profit: 2 }] },
      { ...settlement, settlements: [{ ...settlement.settlements[0], beatTheHouse: { ...exact, returnedHalfUnits: 4 } }] },
      { ...settlement, settlements: [{ ...settlement.settlements[0], beatTheHouse: { ...exact, halfChipAfter: 1 } }] },
      { ...settlement, settlements: [{ ...settlement.settlements[0], beatTheHouse: { ...exact, wholeCreditsReleased: 2 } }] },
    ];
    for (const value of invalidSettlements) {
      expect(serverMessageSchema.safeParse(value).success).toBe(false);
      expect(decodeServerMessage(JSON.stringify(value))).toBeUndefined();
    }

    expect(
      serverMessageSchema.safeParse({
        ...settlement,
        settlements: [{ ...settlement.settlements[0], beatTheHouse: undefined }],
      }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        ...settlement,
        settlements: [{ ...settlement.settlements[0], kind: undefined, beatTheHouse: undefined, wagered: 25, returned: 50, profit: 25 }],
      }).success,
    ).toBe(true);
  });

  it('defaults missing game credits and rejects invalid residuals at the profile boundary', () => {
    const [alice] = profileStoreContractFixtures.current.profiles;
    if (!alice) {
      throw new Error('Missing contract profile.');
    }
    const legacyProfile: Record<string, JsonValue> = { ...alice };
    delete legacyProfile.gameCredits;

    const legacy = parseCasinoSaveState({ profiles: [legacyProfile] });
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) {
      throw new Error('Legacy profile should parse.');
    }
    const [legacyParsed] = legacy.value.profiles;
    if (!legacyParsed) {
      throw new Error('Missing parsed profile.');
    }
    expect(legacyParsed.gameCredits).toEqual({ beatTheHouseHalfChip: 0 });

    for (const value of [-1, 0.5, 2, '1']) {
      expect(parseCasinoSaveState({ profiles: [{ ...alice, gameCredits: { beatTheHouseHalfChip: value } }] }).ok).toBe(false);
    }
  });

  it('validates exact Beat the House receipt values and conservation', () => {
    const receipt = {
      settlementKey: 'receipt-1',
      profileId: 'profile-receipt',
      profileCreatedAt: '2026-05-04T12:00:00.000Z',
      gameId: 'beat-the-house',
      roomId: 'ROOM1',
      sessionId: 'SESSION1',
      returnedHalfUnits: 5,
      profitHalfUnits: 3,
      halfChipBefore: 1,
      halfChipAfter: 0,
      wholeCreditsReleased: 3,
      houseAdvanceRepayment: 1,
      bankrollAfter: 52,
      houseAdvanceAfter: { outstandingBalance: 99, activeCount: 1 },
    };

    expect(beatTheHouseSettlementReceiptSchema.safeParse(receipt).success).toBe(true);
    expect(beatTheHouseSettlementReceiptSchema.safeParse({ ...receipt, extra: true }).success).toBe(false);
    expect(beatTheHouseSettlementReceiptSchema.safeParse({ ...receipt, returnedHalfUnits: 0.5 }).success).toBe(false);
    expect(beatTheHouseSettlementReceiptSchema.safeParse({ ...receipt, halfChipAfter: 2 }).success).toBe(false);
    expect(beatTheHouseSettlementReceiptSchema.safeParse({ ...receipt, wholeCreditsReleased: 2 }).success).toBe(false);
    expect(beatTheHouseSettlementReceiptSchema.safeParse({ ...receipt, houseAdvanceRepayment: 4 }).success).toBe(false);
  });

  it('carries residual game credits only inside data-state profile state', () => {
    const [alice] = profileStoreContractFixtures.current.profiles;
    if (!alice) {
      throw new Error('Missing contract profile.');
    }
    const profileState = { profiles: [{ ...alice, gameCredits: { beatTheHouseHalfChip: 1 } }] };
    const message = decodeServerMessage(JSON.stringify({ type: 'data-state', database: 'memory', profileState }));
    if (!message || message.type !== 'data-state') {
      throw new Error('Expected a data-state message.');
    }
    const [profile] = message.profileState.profiles;
    if (!profile) {
      throw new Error('Missing data-state profile.');
    }
    expect(profile.gameCredits).toEqual({ beatTheHouseHalfChip: 1 });

    const roomStateFixture = serverMessageContractFixtures.find((fixture) => fixture.type === 'room-state');
    if (!roomStateFixture) {
      throw new Error('Missing room-state fixture.');
    }
    const tamperedRoom = JSON.parse(JSON.stringify(roomStateFixture)) as { room: { players: Record<string, JsonValue>[] } };
    const [firstPlayer] = tamperedRoom.room.players;
    if (!firstPlayer) {
      throw new Error('Missing room player.');
    }
    firstPlayer.gameCredits = { beatTheHouseHalfChip: 1 };
    expect(decodeServerMessage(JSON.stringify(tamperedRoom))).toBeUndefined();

    const snapshot = new BeatTheHouseGame({ initialBankroll: 100 }).snapshot();
    expect(gameSnapshotSchema.safeParse({ ...snapshot, gameCredits: { beatTheHouseHalfChip: 1 } }).success).toBe(false);
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
