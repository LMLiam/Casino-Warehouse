import { z } from 'zod';
import type { CasinoProfile } from '../../state/profiles/CasinoProfile';
import { defaultGameCredits } from '../../state/profiles/defaultGameCredits';
import { bankrollTransactionSchema } from './bankrollTransactionSchema';
import { creditSchema } from './creditSchema';
import { gameCreditsSchema } from './gameCreditsSchema';
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
    gameCredits: gameCreditsSchema.default(defaultGameCredits),
    houseAdvance: houseAdvanceStateSchema,
    stats: profileStatsSchema,
    transactions: z.array(bankrollTransactionSchema),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .strict() satisfies z.ZodType<CasinoProfile>;
