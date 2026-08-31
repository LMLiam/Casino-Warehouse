import type { z } from 'zod';
import { handResultSchema } from '../../schemas/casinoSchemas/handResultSchema';

export type HandResult = z.infer<typeof handResultSchema>;
