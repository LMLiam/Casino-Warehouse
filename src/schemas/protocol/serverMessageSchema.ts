import { z } from 'zod';
import type { CasinoSaveState } from '../../state/profiles/CasinoSaveState';
import type { CasinoSessionState } from '../../state/session/CasinoSessionState';
import type { RoomGameSnapshot } from '../../multiplayer/protocol/RoomGameSnapshot';
import type { RoomPlayer } from '../../multiplayer/protocol/RoomPlayer';
import type { RoomSeat } from '../../multiplayer/protocol/RoomSeat';
import type { RoomSettlement } from '../../multiplayer/protocol/RoomSettlement';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import type { RoomSummary } from '../../multiplayer/protocol/RoomSummary';
import { casinoSaveStateSchema } from '../casinoSchemas/casinoSaveStateSchema';
import { currentProtocolVersionSchema } from '../casinoSchemas/currentProtocolVersionSchema';
import { roomGameIdSchema } from '../casinoSchemas/roomGameIdSchema';
import { roomRoleSchema } from '../casinoSchemas/roomRoleSchema';
import { roomSeatIdSchema } from '../casinoSchemas/roomSeatIdSchema';

export const serverMessageSchema = (() => {
  const finiteNumberSchema = z.number().finite();

  const baseServerMessageSchema = z.object({
    version: currentProtocolVersionSchema,
    type: z.string(),
  });

  const serverDatabaseChoiceSchema = z.enum(['memory', 'sqlite']);
  const roomStatusSchema = z.enum(['waiting', 'betting', 'open', 'in-progress', 'settling', 'complete', 'closed']);
  const roomPhaseSchema = z.enum(['lobby', 'betting', 'playing', 'settled']);
  const gameSnapshotShapeSchema = z.record(z.string(), z.unknown());
  const casinoSessionStateSchema = z.custom<CasinoSessionState>((value) => typeof value === 'object' && value !== null);
  const profileStateSchema = z.custom<CasinoSaveState>((value) => casinoSaveStateSchema.safeParse(value).success);
  const ownedProfileIdsSchema = z.custom<readonly string[]>((value) => z.array(z.string()).safeParse(value).success);

  const roomPlayerShapeSchema = z.object({
    connectionId: z.string(),
    profileId: z.string(),
    profileName: z.string(),
    bankroll: finiteNumberSchema,
    sessionStartBankroll: finiteNumberSchema,
    role: roomRoleSchema,
  });
  const roomPlayerSchema = z.custom<RoomPlayer>((value) => roomPlayerShapeSchema.safeParse(value).success);

  const roomSeatShapeSchema = z.object({
    seatId: roomSeatIdSchema,
    profileId: z.string().optional(),
  });
  const roomSeatSchema = z.custom<RoomSeat>((value) => roomSeatShapeSchema.safeParse(value).success);

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
  const roomSummarySchema = z.custom<RoomSummary>((value) => roomSummaryShapeSchema.safeParse(value).success);
  const roomSummariesSchema = z.custom<readonly RoomSummary[]>((value) => z.array(roomSummarySchema).safeParse(value).success);

  const slotsRoomStateSchema = z.object({
    wager: finiteNumberSchema,
    wagersByProfileId: z.record(z.string(), finiteNumberSchema),
    readyProfileIds: z.array(z.string()),
    lastSpinByProfileId: z.string().optional(),
    returnedByProfileId: z.record(z.string(), finiteNumberSchema).optional(),
  });
  const beatRoomStateSchema = z.object({
    rebetSeatIds: z.array(z.enum(['left', 'centre', 'right'])),
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
    players: z.array(roomPlayerSchema),
    spectators: z.array(roomPlayerSchema),
    seats: z.array(roomSeatSchema),
    game: z.custom<RoomGameSnapshot>((value) => gameSnapshotShapeSchema.safeParse(value).success),
    beat: beatRoomStateSchema.optional(),
    slots: slotsRoomStateSchema.optional(),
  });
  const roomSnapshotSchema = z.custom<RoomSnapshot>((value) => roomSnapshotShapeSchema.safeParse(value).success);

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
  const roomSettlementSchema = z.custom<RoomSettlement>((value) => roomSettlementShapeSchema.safeParse(value).success);
  const roomSettlementsSchema = z.custom<readonly RoomSettlement[]>((value) => z.array(roomSettlementSchema).safeParse(value).success);

  return z.discriminatedUnion('type', [
    baseServerMessageSchema.extend({ type: z.literal('server-hello'), serverInstanceId: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('reload-required'), reason: z.literal('server-restarted'), message: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('profile-credentials'), profileId: z.string(), profileToken: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('profile-access'), ownedProfileIds: ownedProfileIdsSchema }),
    baseServerMessageSchema.extend({ type: z.literal('admin-access'), authorized: z.boolean() }),
    baseServerMessageSchema.extend({
      type: z.literal('data-state'),
      database: serverDatabaseChoiceSchema,
      profileState: profileStateSchema,
      session: casinoSessionStateSchema.optional(),
    }),
    baseServerMessageSchema.extend({ type: z.literal('heartbeat'), sentAt: finiteNumberSchema }),
    baseServerMessageSchema.extend({ type: z.literal('room-created'), room: roomSnapshotSchema, invitePath: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('room-closed'), roomId: z.string(), gameId: roomGameIdSchema, reason: z.string() }),
    baseServerMessageSchema.extend({ type: z.literal('room-list'), gameId: roomGameIdSchema, rooms: roomSummariesSchema }),
    baseServerMessageSchema.extend({ type: z.literal('room-state'), room: roomSnapshotSchema }),
    baseServerMessageSchema.extend({
      type: z.literal('settlement'),
      roomId: z.string(),
      sessionId: z.string(),
      settlements: roomSettlementsSchema,
    }),
    baseServerMessageSchema.extend({ type: z.literal('error'), code: z.string(), message: z.string() }),
  ]);
})();
