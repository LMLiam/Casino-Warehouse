import { creditSchema } from './creditSchema';

export const positiveCreditSchema = creditSchema.refine((value) => value > 0, 'Amount must be greater than zero.');
