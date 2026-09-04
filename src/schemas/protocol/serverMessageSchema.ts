import { z } from 'zod';
import { blackjackSnapshotSchema } from '../casinoSchemas/blackjackSnapshotSchema';
import { blackjackTableSnapshotSchema } from '../casinoSchemas/blackjackTableSnapshotSchema';
import { beatTheHouseSettlementDataSchema } from './beatTheHouseSettlementDataSchema';
import { casinoSaveStateSchema } from '../casinoSchemas/casinoSaveStateSchema';
import { connectionIdSchema } from '../casinoSchemas/connectionIdSchema';
import { finiteNumberSchema } from '../casinoSchemas/finiteNumberSchema';
import { gameSnapshotSchema } from '../casinoSchemas/gameSnapshotSchema';
import { handIdSchema } from '../casinoSchemas/handIdSchema';
import { profileTokenSchema } from '../casinoSchemas/profileTokenSchema';
import { profileIdSchema } from '../casinoSchemas/profileIdSchema';
import { roomPhaseSchema } from '../casinoSchemas/roomPhaseSchema';
import { roomGameIdSchema } from '../casinoSchemas/roomGameIdSchema';
import { roomIdSchema } from '../casinoSchemas/roomIdSchema';
import { roomReadyPhaseSchema } from '../casinoSchemas/roomReadyPhaseSchema';
import { roomRoleSchema } from '../casinoSchemas/roomRoleSchema';
import { roomSeatIdSchema } from '../casinoSchemas/roomSeatIdSchema';
import { roomStatusSchema } from '../casinoSchemas/roomStatusSchema';
import { serverInstanceIdSchema } from '../casinoSchemas/serverInstanceIdSchema';
import { sessionIdSchema } from '../casinoSchemas/sessionIdSchema';
import { settlementIdSchema } from '../casinoSchemas/settlementIdSchema';
import { sessionStateSchema } from '../casinoSchemas/sessionStateSchema';
import { slotSnapshotSchema } from '../casinoSchemas/slotSnapshotSchema';

export const serverMessageSchema = (() => {
  const baseServerMessageSchema = z
    .object({
      type: z.string(),
    })
    .strict();

  const serverDatabaseChoiceSchema = z.enum(['memory', 'sqlite']);
  const roomGameSnapshotSchema = z.union([gameSnapshotSchema, blackjackSnapshotSchema, blackjackTableSnapshotSchema, slotSnapshotSchema]);

  const roomPlayerShapeSchema = z
    .object({
      connectionId: connectionIdSchema,
      profileId: profileIdSchema,
      profileName: z.string(),
      bankroll: finiteNumberSchema,
      sessionStartBankroll: finiteNumberSchema,
      role: roomRoleSchema,
    })
    .strict();

  const roomSeatShapeSchema = z
    .object({
      seatId: roomSeatIdSchema,
      profileId: profileIdSchema.optional(),
    })
    .strict();

  const roomSummaryShapeSchema = z
    .object({
      roomId: roomIdSchema,
      roomName: z.string(),
      gameId: roomGameIdSchema,
      gameTitle: z.string(),
      hostProfileId: profileIdSchema,
      maxPlayers: finiteNumberSchema,
      currentPlayers: finiteNumberSchema,
      spectators: finiteNumberSchema,
      status: roomStatusSchema,
      createdAt: finiteNumberSchema,
      updatedAt: finiteNumberSchema,
    })
    .strict();

  const slotsRoomStateSchema = z
    .object({
      wager: finiteNumberSchema,
      wagersByProfileId: z.record(profileIdSchema, finiteNumberSchema),
      readyProfileIds: z.array(profileIdSchema),
      lastSpinByProfileId: profileIdSchema.optional(),
      returnedByProfileId: z.record(profileIdSchema, finiteNumberSchema).optional(),
    })
    .strict();
  const beatRoomStateSchema = z
    .object({
      rebetSeatIds: z.array(handIdSchema),
      readyProfileIds: z.array(profileIdSchema),
      readyCount: finiteNumberSchema,
      playerCount: finiteNumberSchema,
      readyPhase: roomReadyPhaseSchema.optional(),
      nextRoundDeadlineAt: finiteNumberSchema.optional(),
      nextRoundRemainingMs: finiteNumberSchema.optional(),
    })
    .strict();

  const roomSnapshotShapeSchema = z
    .object({
      roomId: roomIdSchema,
      roomName: z.string(),
      hostProfileId: profileIdSchema,
      gameId: roomGameIdSchema,
      gameTitle: z.string(),
      status: roomStatusSchema,
      phase: roomPhaseSchema,
      sessionId: sessionIdSchema,
      revision: finiteNumberSchema,
      maxPlayers: finiteNumberSchema,
      allowSpectators: z.boolean(),
      createdAt: finiteNumberSchema,
      updatedAt: finiteNumberSchema,
      players: z.array(roomPlayerShapeSchema),
      spectators: z.array(roomPlayerShapeSchema),
      seats: z.array(roomSeatShapeSchema),
      game: roomGameSnapshotSchema,
      beat: beatRoomStateSchema.optional(),
      slots: slotsRoomStateSchema.optional(),
    })
    .strict();

  const roomSettlementShapeSchema = z
    .object({
      id: settlementIdSchema,
      kind: z.enum(['gameplay', 'dealer-thanks']).optional(),
      profileId: profileIdSchema,
      seatId: roomSeatIdSchema,
      wagered: finiteNumberSchema,
      returned: finiteNumberSchema,
      profit: finiteNumberSchema,
      dealerTip: finiteNumberSchema.optional(),
      dealerThanks: finiteNumberSchema.optional(),
      houseAdvanceRepayment: finiteNumberSchema.optional(),
      beatTheHouse: beatTheHouseSettlementDataSchema.optional(),
    })
    .strict()
    .superRefine((settlement, context) => {
      const beatTheHouse = settlement.beatTheHouse;
      if (!beatTheHouse) {
        return;
      }
      if (settlement.kind === 'dealer-thanks') {
        context.addIssue({ code: 'custom', path: ['kind'], message: 'Beat the House metadata requires a gameplay settlement.' });
      }
      if (!Number.isSafeInteger(settlement.wagered) || settlement.wagered < 0) {
        context.addIssue({ code: 'custom', path: ['wagered'], message: 'Beat the House wager must be a non-negative safe integer.' });
      }
      const stakeHalfUnits = settlement.wagered * 2;
      const expectedReturnedHalfUnits = stakeHalfUnits + beatTheHouse.profitHalfUnits;
      if (
        !Number.isSafeInteger(stakeHalfUnits) ||
        !Number.isSafeInteger(expectedReturnedHalfUnits) ||
        beatTheHouse.returnedHalfUnits !== expectedReturnedHalfUnits
      ) {
        context.addIssue({ code: 'custom', path: ['beatTheHouse'], message: 'Beat the House return and profit are inconsistent with the wager.' });
      }
      if (settlement.returned !== beatTheHouse.returnedHalfUnits / 2) {
        context.addIssue({ code: 'custom', path: ['returned'], message: 'Returned value does not match Beat the House half-units.' });
      }
      if (settlement.profit !== beatTheHouse.profitHalfUnits / 2) {
        context.addIssue({ code: 'custom', path: ['profit'], message: 'Profit value does not match Beat the House half-units.' });
      }
      const totalHalfUnits = beatTheHouse.halfChipBefore + beatTheHouse.returnedHalfUnits;
      const releasedHalfUnits = beatTheHouse.wholeCreditsReleased * 2 + beatTheHouse.halfChipAfter;
      if (!Number.isSafeInteger(totalHalfUnits) || !Number.isSafeInteger(releasedHalfUnits) || totalHalfUnits !== releasedHalfUnits) {
        context.addIssue({ code: 'custom', path: ['beatTheHouse'], message: 'Beat the House residual arithmetic is inconsistent.' });
      }
    });

  return z.discriminatedUnion('type', [
    baseServerMessageSchema.extend({ type: z.literal('server-hello'), serverInstanceId: serverInstanceIdSchema }),
    baseServerMessageSchema.extend({ type: z.literal('reload-required'), reason: z.literal('server-restarted'), message: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('profile-credentials'), profileId: profileIdSchema, profileToken: profileTokenSchema }),
    baseServerMessageSchema.extend({ type: z.literal('profile-access'), ownedProfileIds: z.array(profileIdSchema) }),
    baseServerMessageSchema.extend({ type: z.literal('admin-access'), authorized: z.boolean() }),
    baseServerMessageSchema.extend({
      type: z.literal('data-state'),
      database: serverDatabaseChoiceSchema,
      profileState: casinoSaveStateSchema,
      session: sessionStateSchema.optional(),
    }),
    baseServerMessageSchema.extend({ type: z.literal('heartbeat'), sentAt: finiteNumberSchema }),
    baseServerMessageSchema.extend({ type: z.literal('room-created'), room: roomSnapshotShapeSchema, invitePath: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('room-closed'), roomId: roomIdSchema, gameId: roomGameIdSchema, reason: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('room-list'), gameId: roomGameIdSchema, rooms: z.array(roomSummaryShapeSchema) }),
    baseServerMessageSchema.extend({ type: z.literal('room-state'), room: roomSnapshotShapeSchema }),
    baseServerMessageSchema.extend({
      type: z.literal('settlement'),
      roomId: roomIdSchema,
      sessionId: sessionIdSchema,
      settlements: z.array(roomSettlementShapeSchema),
    }),
    baseServerMessageSchema.extend({ type: z.literal('error'), code: z.string(), message: z.string() }),
  ]);
})();
