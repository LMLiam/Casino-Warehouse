import { z } from 'zod';

export const creditSchema = z.coerce.number({ error: 'Amount must be a finite number.' }).transform((value) => Math.max(0, Math.floor(value)));
