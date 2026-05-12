import { networkCreditSchema } from './networkCreditSchema';

export const positiveNetworkCreditSchema = networkCreditSchema.refine((value) => value > 0, 'Amount must be greater than zero.');
