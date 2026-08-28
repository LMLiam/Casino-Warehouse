import { z } from 'zod';
import type { ProfileStats } from '../../state/profiles/ProfileStats';
import { creditSchema } from './creditSchema';

export const profileStatsSchema = z
  .object({
    totalWagered: creditSchema,
    totalWon: creditSchema,
    netProfit: z.number().finite(),
    biggestWin: creditSchema,
    biggestWager: creditSchema,
    gamesPlayed: creditSchema,
    perGame: z.record(
      z.string(),
      z
        .object({
          gamesPlayed: creditSchema,
          wagered: creditSchema,
          won: creditSchema,
          netProfit: z.number().finite(),
        })
        .strict(),
    ),
    favouriteGame: z.string().optional(),
  })
  .strict() satisfies z.ZodType<ProfileStats>;
