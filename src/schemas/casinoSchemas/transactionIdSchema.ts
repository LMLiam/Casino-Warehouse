import { z } from 'zod';

export const transactionIdSchema = z.string().trim().min(1, 'Transaction id is required.').max(128, 'Transaction id is too long.').brand<'transaction'>();
