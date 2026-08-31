import { describe, expect, it } from 'vitest';
import type { HexColour } from '../../../src/schemas/casinoSchemas/HexColour';
import type { SessionId } from '../../../src/schemas/casinoSchemas/SessionId';
import type { TransactionId } from '../../../src/schemas/casinoSchemas/TransactionId';
import { blackjackSeatIdSchema } from '../../../src/schemas/casinoSchemas/blackjackSeatIdSchema';
import { connectionIdSchema } from '../../../src/schemas/casinoSchemas/connectionIdSchema';
import { hexColourSchema } from '../../../src/schemas/casinoSchemas/hexColourSchema';
import { isoTimestampSchema } from '../../../src/schemas/casinoSchemas/isoTimestampSchema';
import { profileTokenHashSchema } from '../../../src/schemas/casinoSchemas/profileTokenHashSchema';
import { profileTokenSchema } from '../../../src/schemas/casinoSchemas/profileTokenSchema';
import { roomGameIdSchema } from '../../../src/schemas/casinoSchemas/roomGameIdSchema';
import { roomSeatIdSchema } from '../../../src/schemas/casinoSchemas/roomSeatIdSchema';
import { serverInstanceIdSchema } from '../../../src/schemas/casinoSchemas/serverInstanceIdSchema';
import { sessionIdSchema } from '../../../src/schemas/casinoSchemas/sessionIdSchema';
import { settlementIdSchema } from '../../../src/schemas/casinoSchemas/settlementIdSchema';
import { slotThemeIdSchema } from '../../../src/schemas/casinoSchemas/slotThemeIdSchema';
import { transactionGameIdSchema } from '../../../src/schemas/casinoSchemas/transactionGameIdSchema';
import { transactionIdSchema } from '../../../src/schemas/casinoSchemas/transactionIdSchema';
import { createSessionId } from '../../../src/multiplayer/roomAuthorityModel/createSessionId';
import { createSettlementId } from '../../../src/multiplayer/roomAuthorityModel/createSettlementId';
import { parseClientMessage } from '../../../src/multiplayer/protocol/parseClientMessage';
import { serverMessageSchema } from '../../../src/schemas/protocol/serverMessageSchema';

describe('domain string schemas', () => {
  it('normalizes only the domains that define normalization', () => {
    expect(sessionIdSchema.parse('  session-1  ')).toBe('session-1');
    expect(settlementIdSchema.parse('  settlement-1  ')).toBe('settlement-1');
    expect(transactionIdSchema.parse('  transaction-1  ')).toBe('transaction-1');
    expect(connectionIdSchema.parse('  connection-1  ')).toBe('connection-1');
    expect(serverInstanceIdSchema.parse('  server-1  ')).toBe('server-1');
    expect(isoTimestampSchema.parse('2026-05-10T10:01:00.000Z')).toBe('2026-05-10T10:01:00.000Z');
    expect(hexColourSchema.parse('#Ab12Ef')).toBe('#Ab12Ef');
  });

  it('rejects invalid constrained domain values', () => {
    expect(() => sessionIdSchema.parse('   ')).toThrow('Session id is required.');
    expect(() => profileTokenSchema.parse('   ')).toThrow('Token is required.');
    expect(() => profileTokenHashSchema.parse('not-a-hash')).toThrow('Profile token hash is invalid.');
    expect(() => isoTimestampSchema.parse('not-a-timestamp')).toThrow();
    expect(() => hexColourSchema.parse('purple')).toThrow('Colour must be a hex colour.');
    expect(() => slotThemeIdSchema.parse('unknown-theme')).toThrow();
    expect(() => roomGameIdSchema.parse('slots:unknown-theme')).toThrow('Game id is invalid.');
    expect(roomSeatIdSchema.safeParse('seat-0').success).toBe(false);
    expect(() => blackjackSeatIdSchema.parse('dealer')).toThrow('Blackjack seat id is invalid.');
    expect(transactionGameIdSchema.safeParse('slots').success).toBe(false);
  });

  it('keeps native room seat and transaction source domains exact', () => {
    expect(roomSeatIdSchema.parse('left')).toBe('left');
    expect(roomSeatIdSchema.parse('seat-1')).toBe('seat-1');
    expect(transactionGameIdSchema.parse('admin')).toBe('admin');
    expect(transactionGameIdSchema.parse('house-advance')).toBe('house-advance');
    expect(transactionGameIdSchema.parse('blackjack')).toBe('blackjack');
  });

  it('rejects extra fields at the client and server protocol boundaries', () => {
    expect(
      parseClientMessage({
        type: 'authorize-profiles',
        profileTokens: [{ profileId: 'profile-1', profileToken: 'token-1', extra: true }],
      }),
    ).toMatchObject({ ok: false });
    expect(serverMessageSchema.safeParse({ type: 'server-hello', serverInstanceId: 'server-1', extra: true }).success).toBe(false);
  });

  it('returns branded IDs from multiplayer generators', () => {
    expect(createSessionId(() => 0)).toMatch(/^session-/);
    expect(createSettlementId(() => 0)).toMatch(/^settlement-/);
  });

  it('keeps branded identifiers separate at compile time', () => {
    const sessionId = sessionIdSchema.parse('session-1');
    const transactionId: TransactionId = transactionIdSchema.parse('transaction-1');
    const colour = hexColourSchema.parse('#Ab12Ef');
    const acceptsSessionId = (value: SessionId): SessionId => value;
    const acceptsColour = (value: HexColour): HexColour => value;

    expect(acceptsSessionId(sessionId)).toBe(sessionId);
    expect(acceptsColour(colour)).toBe(colour);
    // @ts-expect-error Transaction IDs must not be accepted as session IDs.
    acceptsSessionId(transactionId);
    // @ts-expect-error Profile tokens must not be accepted as colours.
    acceptsColour(profileTokenSchema.parse('token-1'));
  });
});
