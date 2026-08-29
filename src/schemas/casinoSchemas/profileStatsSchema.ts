import { z } from 'zod';
import type { ProfileStats } from '../../state/profiles/ProfileStats';
import { creditSchema } from './creditSchema';
import { finiteNumberSchema } from './finiteNumberSchema';
import { roomGameIdSchema } from './roomGameIdSchema';

export const profileStatsSchema = z
  .object({
    totalWagered: creditSchema,
    totalWon: creditSchema,
    netProfit: finiteNumberSchema,
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
          netProfit: finiteNumberSchema,
        })
        .strict(),
    ),
    favouriteGame: roomGameIdSchema.optional(),
  })
  .strict() satisfies z.ZodType<ProfileStats>;
