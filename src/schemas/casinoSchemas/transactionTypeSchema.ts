import { z } from 'zod';

export const transactionTypeSchema = z.enum([
  'wager',
  'payout',
  'push_refund',
  'bonus',
  'admin_adjustment',
  'reset',
  'import',
  'correction',
  'dealer_tip',
  'dealer_thanks',
  'house_advance_credit',
  'house_advance_repayment',
]);
