import { z } from 'zod';

export const profileStoreV1Schema = (() => {
  const legacyNumberSchema = z.union([z.number(), z.string(), z.null()]);
  const legacyMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.string())]);
  const legacyTransactionSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    profileId: z.string().optional(),
    at: z.string().optional(),
    gameId: z.string().optional(),
    roomId: z.string().optional(),
    sessionId: z.string().optional(),
    type: z.string().nullable().optional(),
    amount: legacyNumberSchema.optional(),
    balanceBefore: legacyNumberSchema.optional(),
    balanceAfter: legacyNumberSchema.optional(),
    description: z.string().optional(),
    note: z.string().optional(),
    metadata: z.record(z.string(), legacyMetadataValueSchema).nullable().optional(),
  });
  const legacyStatsSchema = z.object({
    totalWagered: legacyNumberSchema.optional(),
    totalWon: legacyNumberSchema.optional(),
    netProfit: legacyNumberSchema.optional(),
    biggestWin: legacyNumberSchema.optional(),
    biggestWager: legacyNumberSchema.optional(),
    gamesPlayed: legacyNumberSchema.optional(),
    perGame: z
      .record(
        z.string(),
        z
          .object({
            gamesPlayed: legacyNumberSchema.optional(),
            wagered: legacyNumberSchema.optional(),
            won: legacyNumberSchema.optional(),
            netProfit: legacyNumberSchema.optional(),
          })
          .nullable(),
      )
      .nullable()
      .optional(),
    favouriteGame: z.string().nullable().optional(),
  });
  const legacyProfileSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.union([z.string(), z.number()]).optional(),
    color: z.string().nullable().optional(),
    bankroll: legacyNumberSchema.optional(),
    houseAdvance: z
      .object({
        outstandingBalance: legacyNumberSchema.optional(),
        activeCount: legacyNumberSchema.optional(),
      })
      .nullable()
      .optional(),
    stats: legacyStatsSchema.nullable().optional(),
    transactions: z.array(legacyTransactionSchema).nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  });

  return z.object({
    version: z.literal(1),
    profiles: z.array(legacyProfileSchema),
  });
})();
