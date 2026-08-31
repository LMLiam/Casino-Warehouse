import { z } from 'zod';
import type { BankrollTransaction } from '../../state/profiles/BankrollTransaction';
import { creditSchema } from './creditSchema';
import { isoTimestampSchema } from './isoTimestampSchema';
import { metadataSchema } from './metadataSchema';
import { profileIdSchema } from './profileIdSchema';
import { roomIdSchema } from './roomIdSchema';
import { sessionIdSchema } from './sessionIdSchema';
import { transactionGameIdSchema } from './transactionGameIdSchema';
import { transactionIdSchema } from './transactionIdSchema';
import { transactionTypeSchema } from './transactionTypeSchema';

export const bankrollTransactionSchema = z
  .object({
    id: transactionIdSchema,
    profileId: profileIdSchema,
    at: isoTimestampSchema,
    gameId: transactionGameIdSchema,
    roomId: roomIdSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    type: transactionTypeSchema,
    amount: z.int(),
    balanceBefore: creditSchema,
    balanceAfter: creditSchema,
    description: z.string(),
    metadata: metadataSchema,
  })
  .strict() satisfies z.ZodType<BankrollTransaction>;
