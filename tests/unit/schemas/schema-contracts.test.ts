import { describe, expect, it } from 'vitest';
import { decodeServerMessage } from '../../../src/multiplayer/protocol/decodeServerMessage';
import { parseClientMessage } from '../../../src/multiplayer/protocol/parseClientMessage';
import { serverMessageSchema } from '../../../src/schemas/protocol/serverMessageSchema';
import { parseCasinoSaveState } from '../../../src/state/profiles/parseCasinoSaveState';
import { parseProfileStoreJson } from '../../../src/state/profiles/parseProfileStoreJson';
import { parseSessionState } from '../../../src/state/session/parseSessionState';
import { clientMessageSchema } from '../../../src/schemas/protocol/clientMessageSchema';
import {
  clientMessageContractFixtures,
  clientProtocolInvalidFixtures,
  profileStoreContractFixtures,
  serverMessageContractFixtures,
  serverProtocolInvalidFixtures,
  sessionStateContractFixtures,
} from './schema-contract-fixtures';

describe('schema contract fixtures', () => {
  it('keeps a valid fixture for every current client WebSocket message discriminant', () => {
    expect(fixtureTypes(clientMessageContractFixtures)).toEqual(schemaTypes(clientMessageSchema));

    for (const fixture of clientMessageContractFixtures) {
      expect(parseClientMessage(fixture), fixture.type).toMatchObject({ ok: true });
    }
  });

  it('keeps a valid fixture for every current server WebSocket message discriminant', () => {
    expect(fixtureTypes(serverMessageContractFixtures)).toEqual(schemaTypes(serverMessageSchema));

    for (const fixture of serverMessageContractFixtures) {
      expect(serverMessageSchema.safeParse(fixture).success, fixture.type).toBe(true);
      expect(decodeServerMessage(JSON.stringify(fixture))?.type, fixture.type).toBe(fixture.type);
    }
  });

  it('documents representative invalid protocol payloads at runtime boundaries', () => {
    for (const fixture of clientProtocolInvalidFixtures) {
      expect(parseClientMessage(fixture.value), fixture.label).toMatchObject({ ok: false });
    }

    for (const fixture of serverProtocolInvalidFixtures) {
      expect(decodeServerMessage(JSON.stringify(fixture.value)), fixture.label).toBeUndefined();
    }
  });

  it('documents profile-store v1 persistence contracts and migration failures', () => {
    expect(parseProfileStoreJson(JSON.stringify(profileStoreContractFixtures.currentV1))).toEqual(profileStoreContractFixtures.currentV1);

    const legacy = parseCasinoSaveState(profileStoreContractFixtures.legacyV1);
    expect(legacy.profiles[0]).toMatchObject({
      id: 'legacy-profile',
      name: 'Legacy Player',
      bankroll: 75,
      stats: {
        netProfit: 10,
      },
    });
    expect(legacy.profiles[0].color).toMatch(/^#/);
    expect(legacy.profiles[0].transactions.map((transaction) => transaction.type)).toEqual(['push_refund', 'admin_adjustment']);
    expect(legacy.profiles[0].transactions[0].description).toBe('Legacy push refund.');

    expect(() => parseCasinoSaveState(profileStoreContractFixtures.malformedV1)).toThrow('Profile record is invalid.');
    expect(() => parseCasinoSaveState(profileStoreContractFixtures.unsupportedVersion)).toThrow('Profile store data version 2 is not supported.');
  });

  it('documents session-state v1 persistence contracts and restore failures', () => {
    expect(parseSessionState(sessionStateContractFixtures.currentV1)).toEqual(sessionStateContractFixtures.currentV1);

    const restoredRoom = parseSessionState(sessionStateContractFixtures.roomRestoreV1);
    expect(restoredRoom).toMatchObject({
      activeGame: 'blackjack',
      room: {
        roomId: 'ROOM99',
        gameId: 'blackjack',
        role: 'spectator',
        seatId: 'seat-2',
      },
    });
    expect(restoredRoom.gameSnapshots['profile-bob'].blackjack).toMatchObject({
      phase: 'settled',
      wager: 50,
      status: 'Representative restored Blackjack snapshot.',
    });

    expect(() => parseSessionState(sessionStateContractFixtures.malformedV1)).toThrow('Session v1 data is not valid.');
    expect(() => parseSessionState(sessionStateContractFixtures.unsupportedVersion)).toThrow('Session data version 2 is not supported.');
  });
});

const fixtureTypes = (fixtures: readonly { readonly type: string }[]): string[] => [...new Set(fixtures.map((fixture) => fixture.type))].sort();

const schemaTypes = (schema: typeof clientMessageSchema | typeof serverMessageSchema): string[] =>
  schema.options.flatMap((option) => [...option.shape.type.values].map(String)).sort();
