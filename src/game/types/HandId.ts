import type { z } from 'zod';
import { handIdSchema } from '../../schemas/casinoSchemas/handIdSchema';

export type HandId = z.infer<typeof handIdSchema>;
