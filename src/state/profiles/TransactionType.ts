import type { z } from 'zod';
import { transactionTypeSchema } from '../../schemas/casinoSchemas/transactionTypeSchema';

export type TransactionType = z.infer<typeof transactionTypeSchema>;
