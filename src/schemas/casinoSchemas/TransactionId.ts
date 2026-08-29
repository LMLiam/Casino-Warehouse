import type { z } from 'zod';
import { transactionIdSchema } from './transactionIdSchema';

export type TransactionId = z.infer<typeof transactionIdSchema>;
