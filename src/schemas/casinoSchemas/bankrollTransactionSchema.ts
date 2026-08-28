import { z } from 'zod';
import type { BankrollTransaction } from '../../state/profiles/BankrollTransaction';
import { creditSchema } from './creditSchema';
import { metadataSchema } from './metadataSchema';
import { transactionTypeSchema } from './transactionTypeSchema';

export const bankrollTransactionSchema = z
  .object({
    id: z.string().min(1),
    profileId: z.string(),
    at: z.string(),
    gameId: z.string().min(1),
    roomId: z.string().optional(),
    sessionId: z.string().optional(),
    type: transactionTypeSchema,
    amount: z.number().finite().int(),
    balanceBefore: creditSchema,
    balanceAfter: creditSchema,
    description: z.string(),
    metadata: metadataSchema,
  })
  .strict() satisfies z.ZodType<BankrollTransaction>;
