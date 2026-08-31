import { z } from 'zod';

export const networkCreditSchema = z.number({ error: 'Amount must be a finite number.' }).transform((value) => Math.max(0, Math.floor(value)));
