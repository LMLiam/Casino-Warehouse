import { describe, expect, it } from 'vitest';
import { decodeServerMessage } from '../../../src/multiplayer/protocol/decodeServerMessage';
import { parseClientMessage } from '../../../src/multiplayer/protocol/parseClientMessage';
import { serverMessageSchema } from '../../../src/schemas/protocol/serverMessageSchema';
import { parseCasinoSaveState } from '../../../src/state/profiles/parseCasinoSaveState';
import { parseProfileStoreJson } from '../../../src/state/profiles/parseProfileStoreJson';
import { parseSessionState } from '../../../src/state/session/parseSessionState';
import { clientMessageSchema } from '../../../src/schemas/protocol/clientMessageSchema';
import type { JsonValue } from '../../../src/schemas/casinoSchemas/JsonValue';
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

  it('accepts only the current unversioned profile-store contract', () => {
    expect(parseProfileStoreJson(JSON.stringify(profileStoreContractFixtures.current))).toEqual({ ok: true, value: profileStoreContractFixtures.current });

    const malformed = parseCasinoSaveState(profileStoreContractFixtures.malformed);
    expect(malformed).toMatchObject({ ok: false, error: { message: expect.stringContaining('Save data is not a casino profile store') } });

    const obsoleteVersion = parseCasinoSaveState(profileStoreContractFixtures.obsoleteVersion);
    expect(obsoleteVersion).toMatchObject({ ok: false, error: { message: expect.stringContaining('Unrecognized key: "version"') } });
  });

  it('defaults a missing gameCredits field while keeping the store contract strict', () => {
    const [alice] = profileStoreContractFixtures.current.profiles;
    if (!alice) {
      throw new Error('Missing contract profile.');
    }
    const legacyProfile: Record<string, JsonValue> = { ...alice };
    delete legacyProfile.gameCredits;

    expect(parseProfileStoreJson(JSON.stringify({ profiles: [legacyProfile] }))).toEqual({
      ok: true,
      value: profileStoreContractFixtures.current,
    });
  });

  it('accepts only the current unversioned session-state contract', () => {
    expect(parseSessionState(sessionStateContractFixtures.current)).toEqual({ ok: true, value: sessionStateContractFixtures.current });

    const restoredRoom = parseSessionState(sessionStateContractFixtures.roomRestore);
    expect(restoredRoom).toMatchObject({
      ok: true,
      value: {
        activeGame: 'blackjack',
        room: {
          roomId: 'ROOM99',
          gameId: 'blackjack',
          role: 'spectator',
          seatId: 'seat-2',
        },
      },
    });
    if (restoredRoom.ok) {
      expect(restoredRoom.value.gameSnapshot?.blackjack).toMatchObject({
        phase: 'settled',
        wager: 50,
        status: 'Representative restored Blackjack snapshot.',
      });
    }

    const malformed = parseSessionState(sessionStateContractFixtures.malformed);
    expect(malformed).toMatchObject({ ok: false, error: { message: expect.stringContaining('Session data is not valid') } });

    const obsoleteVersion = parseSessionState(sessionStateContractFixtures.obsoleteVersion);
    expect(obsoleteVersion).toMatchObject({ ok: false, error: { message: expect.stringContaining('Unrecognized key: "version"') } });
  });
});

const fixtureTypes = (fixtures: readonly { readonly type: string }[]): string[] => [...new Set(fixtures.map((fixture) => fixture.type))].sort();

const schemaTypes = (schema: typeof clientMessageSchema | typeof serverMessageSchema): string[] =>
  schema.options.flatMap((option) => [...option.shape.type.values].map(String)).sort();
