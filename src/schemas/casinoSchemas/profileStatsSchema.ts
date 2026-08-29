import { z } from 'zod';
import type { ProfileStats } from '../../state/profiles/ProfileStats';
import { creditSchema } from './creditSchema';
import { roomGameIdSchema } from './roomGameIdSchema';

export const profileStatsSchema = z
  .object({
    totalWagered: creditSchema,
    totalWon: creditSchema,
    netProfit: z.number().finite(),
    biggestWin: creditSchema,
    biggestWager: creditSchema,
    gamesPlayed: creditSchema,
    perGame: z.partialRecord(
      roomGameIdSchema,
      z
        .object({
          gamesPlayed: creditSchema,
          wagered: creditSchema,
          won: creditSchema,
          netProfit: z.number().finite(),
        })
        .strict(),
    ),
    favouriteGame: roomGameIdSchema.optional(),
  })
  .strict() satisfies z.ZodType<ProfileStats>;
