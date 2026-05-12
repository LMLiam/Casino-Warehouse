import { z } from 'zod';
import { creditSchema } from './creditSchema';

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
