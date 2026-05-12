import { z } from 'zod';
import { bankrollTransactionSchema } from './bankrollTransactionSchema';
import { creditSchema } from './creditSchema';
import { profileNameSchema } from './profileNameSchema';
import { profileStatsSchema } from './profileStatsSchema';

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
