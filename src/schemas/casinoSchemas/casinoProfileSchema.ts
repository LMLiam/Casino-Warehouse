import { z } from 'zod';
import type { CasinoProfile } from '../../state/profiles/CasinoProfile';
import { bankrollTransactionSchema } from './bankrollTransactionSchema';
import { creditSchema } from './creditSchema';
import { houseAdvanceStateSchema } from './houseAdvanceStateSchema';
import { profileNameSchema } from './profileNameSchema';
import { profileStatsSchema } from './profileStatsSchema';

export const casinoProfileSchema = z
  .object({
    id: z.string().min(1, 'Profile id is required.'),
    name: profileNameSchema,
    color: z.string(),
    bankroll: creditSchema,
    houseAdvance: houseAdvanceStateSchema,
    stats: profileStatsSchema,
    transactions: z.array(bankrollTransactionSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict() satisfies z.ZodType<CasinoProfile>;
