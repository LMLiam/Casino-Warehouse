import { z } from 'zod';
import type { CasinoProfile } from '../../state/profiles/CasinoProfile';
import { bankrollTransactionSchema } from './bankrollTransactionSchema';
import { creditSchema } from './creditSchema';
import { houseAdvanceStateSchema } from './houseAdvanceStateSchema';
import { hexColourSchema } from './hexColourSchema';
import { isoTimestampSchema } from './isoTimestampSchema';
import { profileIdSchema } from './profileIdSchema';
import { profileNameSchema } from './profileNameSchema';
import { profileStatsSchema } from './profileStatsSchema';

export const casinoProfileSchema = z
  .object({
    id: profileIdSchema,
    name: profileNameSchema,
    color: hexColourSchema,
    bankroll: creditSchema,
    houseAdvance: houseAdvanceStateSchema,
    stats: profileStatsSchema,
    transactions: z.array(bankrollTransactionSchema),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .strict() satisfies z.ZodType<CasinoProfile>;
