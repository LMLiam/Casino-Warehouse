import { z } from 'zod';

export const transactionTypeSchema = z.enum(['wager', 'payout', 'push_refund', 'bonus', 'admin_adjustment', 'reset', 'import', 'correction']);
