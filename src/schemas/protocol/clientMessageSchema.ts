import { z } from 'zod';
import { betTypeSchema } from '../casinoSchemas/betTypeSchema';
import { authTokenSchema } from '../casinoSchemas/authTokenSchema';
import { handIdSchema } from '../casinoSchemas/handIdSchema';
import { networkCreditSchema } from '../casinoSchemas/networkCreditSchema';
import { playerGameSnapshotsSchema } from '../casinoSchemas/playerGameSnapshotsSchema';
import { positiveNetworkCreditSchema } from '../casinoSchemas/positiveNetworkCreditSchema';
import { profileIdSchema } from '../casinoSchemas/profileIdSchema';
import { profileNameSchema } from '../casinoSchemas/profileNameSchema';
import { profileTokenSchema } from '../casinoSchemas/profileTokenSchema';
import { roomGameIdSchema } from '../casinoSchemas/roomGameIdSchema';
import { roomIdSchema } from '../casinoSchemas/roomIdSchema';
import { roomNameSchema } from '../casinoSchemas/roomNameSchema';
import { roomRoleSchema } from '../casinoSchemas/roomRoleSchema';
import { roomSeatIdSchema } from '../casinoSchemas/roomSeatIdSchema';

export const clientMessageSchema = (() => {
  const baseClientMessageSchema = z
    .object({
      type: z.string(),
    })
    .strict();

  const identitySchema = z
    .object({
      profileId: profileIdSchema,
      profileName: profileNameSchema,
      bankroll: networkCreditSchema,
    })
    .strict();

  const profileTokenEntrySchema = z
    .object({
      profileId: profileIdSchema,
      profileToken: profileTokenSchema,
    })
    .strict();

  const clientSessionStateSchema = z
    .object({
      profileId: profileIdSchema,
      activeGame: roomGameIdSchema,
      showingGameLobby: z.boolean(),
      wagerLimit: networkCreditSchema,
      wagered: networkCreditSchema,
      gameSnapshot: playerGameSnapshotsSchema.optional(),
      room: z
        .object({
          roomId: roomIdSchema,
          gameId: roomGameIdSchema,
          role: roomRoleSchema,
          seatId: roomSeatIdSchema.optional(),
        })
        .strict()
        .optional(),
    })
    .strict();

  return z.discriminatedUnion('type', [
    baseClientMessageSchema.extend({ type: z.literal('request-data') }),
    baseClientMessageSchema.extend({ type: z.literal('authorize-profiles'), profileTokens: z.array(profileTokenEntrySchema) }),
    baseClientMessageSchema.extend({ type: z.literal('authorize-admin'), adminToken: authTokenSchema }),
    baseClientMessageSchema.extend({ type: z.literal('create-profile'), profileName: profileNameSchema }),
    baseClientMessageSchema.extend({ type: z.literal('rename-profile'), profileId: profileIdSchema, profileName: profileNameSchema }),
    baseClientMessageSchema.extend({ type: z.literal('delete-profile'), profileId: profileIdSchema }),
    baseClientMessageSchema.extend({ type: z.literal('house-advance'), profileId: profileIdSchema }),
    baseClientMessageSchema.extend({ type: z.literal('save-session'), session: clientSessionStateSchema }),
    baseClientMessageSchema.extend({
      type: z.literal('admin-bankroll'),
      profileId: profileIdSchema,
      action: z.enum(['add', 'subtract', 'reset']),
      amount: networkCreditSchema.optional(),
    }),
    baseClientMessageSchema.extend({ type: z.literal('admin-reset-all') }),
    baseClientMessageSchema.extend({ type: z.literal('clear-server-data') }),
    baseClientMessageSchema.extend({ type: z.literal('heartbeat-ack'), sentAt: networkCreditSchema }),
    baseClientMessageSchema.extend({ type: z.literal('list-rooms'), gameId: roomGameIdSchema }),
    baseClientMessageSchema
      .extend({
        type: z.literal('create-room'),
        gameId: roomGameIdSchema,
        roomName: roomNameSchema,
        maxPlayers: networkCreditSchema.optional(),
        allowSpectators: z.boolean().optional(),
      })
      .merge(identitySchema),
    baseClientMessageSchema
      .extend({
        type: z.literal('join-room'),
        gameId: roomGameIdSchema,
        roomId: roomIdSchema,
        role: roomRoleSchema.default('player'),
        seatId: roomSeatIdSchema.optional(),
      })
      .merge(identitySchema),
    baseClientMessageSchema.extend({ type: z.literal('leave-room') }),
    baseClientMessageSchema.extend({ type: z.literal('assign-seat'), seatId: roomSeatIdSchema }),
    baseClientMessageSchema.extend({ type: z.literal('place-chip'), seatId: handIdSchema, betType: betTypeSchema, amount: positiveNetworkCreditSchema }),
    baseClientMessageSchema.extend({ type: z.literal('place-tip'), seatId: handIdSchema, amount: positiveNetworkCreditSchema }),
    baseClientMessageSchema.extend({ type: z.literal('blackjack-deal'), wager: positiveNetworkCreditSchema }),
    baseClientMessageSchema.extend({ type: z.literal('blackjack-action'), action: z.enum(['hit', 'stand', 'double', 'split', 'insurance', 'new-hand']) }),
    baseClientMessageSchema.extend({ type: z.literal('slots-wager'), wager: positiveNetworkCreditSchema }),
    baseClientMessageSchema.extend({ type: z.literal('slots-ready'), ready: z.boolean() }),
    baseClientMessageSchema.extend({ type: z.literal('slots-spin') }),
    baseClientMessageSchema.extend({ type: z.literal('slots-pick-bonus') }),
    baseClientMessageSchema.extend({ type: z.literal('clear-bets') }),
    baseClientMessageSchema.extend({ type: z.literal('rebet') }),
    baseClientMessageSchema.extend({ type: z.literal('start-round') }),
    baseClientMessageSchema.extend({ type: z.literal('player-action'), action: z.enum(['hit', 'stick']) }),
    baseClientMessageSchema.extend({ type: z.literal('next-round') }),
    baseClientMessageSchema.extend({
      type: z.literal('admin-debug'),
      action: z.enum(['reset-room', 'force-settle']),
      reason: z.string().trim().max(160).optional(),
    }),
    baseClientMessageSchema.extend({ type: z.literal('resync') }),
  ]);
})();
