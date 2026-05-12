import { z } from 'zod';
import { betTypeSchema } from './betTypeSchema';
import { handIdSchema } from './handIdSchema';
import { networkCreditSchema } from './networkCreditSchema';
import { positiveNetworkCreditSchema } from './positiveNetworkCreditSchema';
import { profileIdSchema } from './profileIdSchema';
import { profileNameSchema } from './profileNameSchema';
import { protocolVersionSchema } from './protocolVersionSchema';
import { roomGameIdSchema } from './roomGameIdSchema';
import { roomNameSchema } from './roomNameSchema';
import { roomRoleSchema } from './roomRoleSchema';
import { roomSeatIdSchema } from './roomSeatIdSchema';

const baseClientMessageSchema = z.object({
  version: protocolVersionSchema,
  type: z.string(),
});

const identitySchema = z.object({
  profileId: profileIdSchema,
  profileName: profileNameSchema,
  bankroll: networkCreditSchema,
});

const profileTokenSchema = z.string().trim().min(1).max(256);

const profileTokenEntrySchema = z.object({
  profileId: profileIdSchema,
  profileToken: profileTokenSchema,
});

const clientSessionStateSchema = z.object({
  profileIds: z.array(profileIdSchema),
  selectedPlayerIndex: networkCreditSchema,
  activeGame: roomGameIdSchema,
  showingGameLobby: z.boolean(),
  wagerLimit: networkCreditSchema,
  wagered: networkCreditSchema,
  gameSnapshots: z.record(z.string(), z.record(z.string(), z.unknown())),
  room: z
    .object({
      roomId: z
        .string()
        .trim()
        .min(1)
        .transform((value) => value.toUpperCase()),
      gameId: roomGameIdSchema,
      role: roomRoleSchema,
      seatId: roomSeatIdSchema.optional(),
    })
    .optional(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  baseClientMessageSchema.extend({ type: z.literal('request-data') }),
  baseClientMessageSchema.extend({ type: z.literal('authorize-profiles'), profileTokens: z.array(profileTokenEntrySchema) }),
  baseClientMessageSchema.extend({ type: z.literal('authorize-admin'), adminToken: profileTokenSchema }),
  baseClientMessageSchema.extend({ type: z.literal('create-profile'), profileName: profileNameSchema }),
  baseClientMessageSchema.extend({ type: z.literal('rename-profile'), profileId: profileIdSchema, profileName: profileNameSchema }),
  baseClientMessageSchema.extend({ type: z.literal('delete-profile'), profileId: profileIdSchema }),
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
      roomId: z
        .string()
        .trim()
        .min(1, 'Room id is required.')
        .transform((value) => value.toUpperCase()),
      role: roomRoleSchema.default('player'),
      seatId: roomSeatIdSchema.optional(),
    })
    .merge(identitySchema),
  baseClientMessageSchema.extend({ type: z.literal('leave-room') }),
  baseClientMessageSchema.extend({ type: z.literal('assign-seat'), seatId: roomSeatIdSchema }),
  baseClientMessageSchema.extend({ type: z.literal('place-chip'), seatId: handIdSchema, betType: betTypeSchema, amount: positiveNetworkCreditSchema }),
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
