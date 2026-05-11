import { z } from 'zod';
import type { CasinoGameId } from '../game/ids';
import { betTypes, handIds, type HandId } from '../game/types';

export const protocolVersionSchema = z.literal(1);

export const creditSchema = z.coerce
  .number()
  .finite('Amount must be a finite number.')
  .transform((value) => Math.max(0, Math.floor(value)));

export const positiveCreditSchema = creditSchema.refine((value) => value > 0, 'Amount must be greater than zero.');
export const networkCreditSchema = z
  .number()
  .finite('Amount must be a finite number.')
  .transform((value) => Math.max(0, Math.floor(value)));
export const positiveNetworkCreditSchema = networkCreditSchema.refine((value) => value > 0, 'Amount must be greater than zero.');

export const profileIdSchema = z.string().trim().min(1, 'Profile id is required.').max(96, 'Profile id is too long.');
export const profileNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ' ').slice(0, 32) || 'Player');

export const roomNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ' ').slice(0, 48))
  .optional();

export const roomGameIdSchema = z.custom<CasinoGameId>(
  (value) => typeof value === 'string' && (value === 'beat-the-house' || value === 'blackjack' || value === 'slots:thai-princess'),
  {
    message: 'Game id is invalid.',
  },
);

export const roomRoleSchema = z.enum(['player', 'spectator']);
export const handIdSchema = z.enum(handIds);
export const betTypeSchema = z.enum(betTypes);
export type ParsedRoomSeatId = HandId | `seat-${number}`;
export const roomSeatIdSchema = z.custom<ParsedRoomSeatId>(
  (value) => handIds.includes(value as HandId) || (typeof value === 'string' && /^seat-[1-9]\d*$/.test(value)),
  {
    message: 'Seat id is invalid.',
  },
);

const baseClientMessageSchema = z.object({
  version: protocolVersionSchema,
  type: z.string(),
});

const identitySchema = z.object({
  profileId: profileIdSchema,
  profileName: profileNameSchema,
  bankroll: networkCreditSchema,
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

export type ClientMessageFromSchema = z.infer<typeof clientMessageSchema>;

export const volumeSchema = z.coerce.number().finite().min(0).max(1);

export const audioSettingsSchema = z.object({
  muted: z.coerce.boolean().default(false),
  masterVolume: volumeSchema.default(0.55),
  musicVolume: volumeSchema.default(0.22),
  effectsVolume: volumeSchema.default(0.7),
  dealingVolume: volumeSchema.default(0.65),
  chipsVolume: volumeSchema.default(0.75),
  slotsVolume: volumeSchema.default(0.7),
  winsVolume: volumeSchema.default(0.8),
  bonusVolume: volumeSchema.default(0.85),
  uiVolume: volumeSchema.default(0.45),
  ambienceVolume: volumeSchema.default(0.25),
});

export type CasinoAudioSettingsFromSchema = z.infer<typeof audioSettingsSchema>;

export const transactionTypeSchema = z.enum(['wager', 'payout', 'push_refund', 'bonus', 'admin_adjustment', 'reset', 'import', 'correction']);
export const metadataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export const profileStatsSchema = z.object({
  totalWagered: creditSchema.default(0),
  totalWon: creditSchema.default(0),
  netProfit: z.coerce.number().finite().default(0),
  biggestWin: creditSchema.default(0),
  biggestWager: creditSchema.default(0),
  gamesPlayed: creditSchema.default(0),
  perGame: z.record(
    z.string(),
    z.object({
      gamesPlayed: creditSchema.default(0),
      wagered: creditSchema.default(0),
      won: creditSchema.default(0),
      netProfit: z.coerce.number().finite().default(0),
    }),
  ),
  favouriteGame: z.string().optional(),
});

export const bankrollTransactionSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().default(''),
  at: z.string().default(() => new Date().toISOString()),
  gameId: z.string().min(1),
  roomId: z.string().optional(),
  sessionId: z.string().optional(),
  type: transactionTypeSchema.catch('correction'),
  amount: z.coerce.number().finite().transform(Math.floor),
  balanceBefore: creditSchema.default(0),
  balanceAfter: creditSchema.default(0),
  description: z.string().default('Imported legacy transaction.'),
  metadata: metadataSchema.default({}),
});

export const casinoProfileSchema = z.object({
  id: z.string().min(1, 'Profile id is required.'),
  name: profileNameSchema,
  color: z.string().optional(),
  bankroll: creditSchema.default(0),
  stats: profileStatsSchema.default({
    totalWagered: 0,
    totalWon: 0,
    netProfit: 0,
    biggestWin: 0,
    biggestWager: 0,
    gamesPlayed: 0,
    perGame: {},
  }),
  transactions: z.array(bankrollTransactionSchema).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export const casinoSaveStateSchema = z.object({
  version: protocolVersionSchema,
  profiles: z.array(casinoProfileSchema),
});

export const casinoSaveStateEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  profiles: z.array(z.unknown()),
});

export const sessionStateSchema = z.object({
  version: protocolVersionSchema,
  profileIds: z.array(z.string()).default([]),
  selectedPlayerIndex: creditSchema.default(0),
  activeGame: roomGameIdSchema.default('beat-the-house'),
  showingGameLobby: z.coerce.boolean().default(true),
  wagerLimit: creditSchema.default(0),
  wagered: creditSchema.default(0),
  gameSnapshots: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export const sessionStateEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  profileIds: z.array(z.unknown()),
});

export const slotSymbolSchema = z.enum(['princess', 'lotus', 'elephant', 'temple', 'fan', 'orchid']);
export const jackpotTierSchema = z.enum(['mini', 'minor', 'major', 'grand']);

export const slotThemeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Slot accent must be a hex colour.'),
  columns: z.number().int().min(3).max(3),
  rows: z.number().int().min(5).max(5),
  wildSymbol: slotSymbolSchema.optional(),
  reelStrip: z.array(slotSymbolSchema).min(3, 'Slot reel strips need at least three symbols.'),
  payouts: z.partialRecord(slotSymbolSchema, z.number().int().positive()),
  jackpots: z.partialRecord(
    jackpotTierSchema,
    z.object({
      symbol: slotSymbolSchema,
      multiplier: z.number().int().positive(),
      label: z.string().min(1),
    }),
  ),
  bonus: z.object({
    triggerSymbol: slotSymbolSchema,
    picks: z.number().int().positive(),
    freeSpinsOnTwoBonus: z.number().int().nonnegative(),
    multipliers: z.array(z.number().int().positive()).min(1),
  }),
});

export const gameCatalogEntrySchema = z.object({
  id: roomGameIdSchema,
  title: z.string().min(1),
  kind: z.enum(['beat-the-house', 'blackjack', 'slots']),
  description: z.string().min(1),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Game accent must be a hex colour.'),
  rules: z.array(z.string().min(1)).min(1),
  paytable: z.array(z.string().min(1)).min(1),
  slotTheme: slotThemeSchema.optional(),
});

export const gameCatalogSchema = z.array(gameCatalogEntrySchema).min(1);

export const zodErrorSummary = (error: z.ZodError): string => error.issues[0]?.message ?? 'Payload is invalid.';
