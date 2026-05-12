import { z } from 'zod';
import { creditSchema } from './creditSchema';
import { metadataSchema } from './metadataSchema';
import { transactionTypeSchema } from './transactionTypeSchema';

export const bankrollTransactionSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().default(''),
  at: z.string().default(() => new Date().toISOString()),
  gameId: z.string().min(1),
  roomId: z.string().optional(),
  sessionId: z.string().optional(),
  type: transactionTypeSchema.catch('correction'),
  amount: z.coerce.number().finite().transform(Math.floor),
  balanceBefore: creditSchema.default(0),
  balanceAfter: creditSchema.default(0),
  description: z.string().default('Imported legacy transaction.'),
  metadata: metadataSchema.default({}),
});
