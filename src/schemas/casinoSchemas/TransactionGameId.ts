import type { z } from 'zod';
import { transactionGameIdSchema } from './transactionGameIdSchema';

export type TransactionGameId = z.infer<typeof transactionGameIdSchema>;
