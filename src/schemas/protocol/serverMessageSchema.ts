import { z } from 'zod';
import { blackjackSnapshotSchema } from '../casinoSchemas/blackjackSnapshotSchema';
import { blackjackTableSnapshotSchema } from '../casinoSchemas/blackjackTableSnapshotSchema';
import { casinoSaveStateSchema } from '../casinoSchemas/casinoSaveStateSchema';
import { gameSnapshotSchema } from '../casinoSchemas/gameSnapshotSchema';
import { roomGameIdSchema } from '../casinoSchemas/roomGameIdSchema';
import { roomRoleSchema } from '../casinoSchemas/roomRoleSchema';
import { roomSeatIdSchema } from '../casinoSchemas/roomSeatIdSchema';
import { sessionStateSchema } from '../casinoSchemas/sessionStateSchema';
import { slotSnapshotSchema } from '../casinoSchemas/slotSnapshotSchema';

export const serverMessageSchema = (() => {
  const finiteNumberSchema = z.number().finite();

  const baseServerMessageSchema = z
    .object({
      type: z.string(),
    })
    .strict();

  const serverDatabaseChoiceSchema = z.enum(['memory', 'sqlite']);
  const roomStatusSchema = z.enum(['waiting', 'betting', 'open', 'in-progress', 'settling', 'complete', 'closed']);
  const roomPhaseSchema = z.enum(['lobby', 'betting', 'playing', 'settled']);
  const roomGameSnapshotSchema = z.union([gameSnapshotSchema, blackjackSnapshotSchema, blackjackTableSnapshotSchema, slotSnapshotSchema]);

  const roomPlayerShapeSchema = z.object({
    connectionId: z.string(),
    profileId: z.string(),
    profileName: z.string(),
    bankroll: finiteNumberSchema,
    sessionStartBankroll: finiteNumberSchema,
    role: roomRoleSchema,
  });

  const roomSeatShapeSchema = z.object({
    seatId: roomSeatIdSchema,
    profileId: z.string().optional(),
  });

  const roomSummaryShapeSchema = z.object({
    roomId: z.string(),
    roomName: z.string(),
    gameId: roomGameIdSchema,
    gameTitle: z.string(),
    hostProfileId: z.string(),
    maxPlayers: finiteNumberSchema,
    currentPlayers: finiteNumberSchema,
    spectators: finiteNumberSchema,
    status: roomStatusSchema,
    createdAt: finiteNumberSchema,
    updatedAt: finiteNumberSchema,
  });

  const slotsRoomStateSchema = z.object({
    wager: finiteNumberSchema,
    wagersByProfileId: z.record(z.string(), finiteNumberSchema),
    readyProfileIds: z.array(z.string()),
    lastSpinByProfileId: z.string().optional(),
    returnedByProfileId: z.record(z.string(), finiteNumberSchema).optional(),
  });
  const beatRoomStateSchema = z.object({
    rebetSeatIds: z.array(z.enum(['left', 'centre', 'right'])),
    readyProfileIds: z.array(z.string()),
    readyCount: finiteNumberSchema,
    playerCount: finiteNumberSchema,
    readyPhase: z.enum(['betting', 'roundOver']).optional(),
    nextRoundDeadlineAt: finiteNumberSchema.optional(),
    nextRoundRemainingMs: finiteNumberSchema.optional(),
  });

  const roomSnapshotShapeSchema = z.object({
    roomId: z.string(),
    roomName: z.string(),
    hostProfileId: z.string(),
    gameId: roomGameIdSchema,
    gameTitle: z.string(),
    status: roomStatusSchema,
    phase: roomPhaseSchema,
    sessionId: z.string(),
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
  });

  const roomSettlementShapeSchema = z.object({
    id: z.string(),
    kind: z.enum(['gameplay', 'dealer-thanks']).optional(),
    profileId: z.string(),
    seatId: roomSeatIdSchema,
    wagered: finiteNumberSchema,
    returned: finiteNumberSchema,
    profit: finiteNumberSchema,
    dealerTip: finiteNumberSchema.optional(),
    dealerThanks: finiteNumberSchema.optional(),
    houseAdvanceRepayment: finiteNumberSchema.optional(),
  });

  return z.discriminatedUnion('type', [
    baseServerMessageSchema.extend({ type: z.literal('server-hello'), serverInstanceId: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('reload-required'), reason: z.literal('server-restarted'), message: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('profile-credentials'), profileId: z.string(), profileToken: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('profile-access'), ownedProfileIds: z.array(z.string()) }),
    baseServerMessageSchema.extend({ type: z.literal('admin-access'), authorized: z.boolean() }),
    baseServerMessageSchema.extend({
      type: z.literal('data-state'),
      database: serverDatabaseChoiceSchema,
      profileState: casinoSaveStateSchema,
      session: sessionStateSchema.optional(),
    }),
    baseServerMessageSchema.extend({ type: z.literal('heartbeat'), sentAt: finiteNumberSchema }),
    baseServerMessageSchema.extend({ type: z.literal('room-created'), room: roomSnapshotShapeSchema, invitePath: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('room-closed'), roomId: z.string(), gameId: roomGameIdSchema, reason: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('room-list'), gameId: roomGameIdSchema, rooms: z.array(roomSummaryShapeSchema) }),
    baseServerMessageSchema.extend({ type: z.literal('room-state'), room: roomSnapshotShapeSchema }),
    baseServerMessageSchema.extend({
      type: z.literal('settlement'),
      roomId: z.string(),
      sessionId: z.string(),
      settlements: z.array(roomSettlementShapeSchema),
    }),
    baseServerMessageSchema.extend({ type: z.literal('error'), code: z.string(), message: z.string() }),
  ]);
})();
