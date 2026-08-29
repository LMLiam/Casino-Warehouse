import type { z } from 'zod';
import { betTypeSchema } from '../../schemas/casinoSchemas/betTypeSchema';

export type BetType = z.infer<typeof betTypeSchema>;
