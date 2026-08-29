import type { z } from 'zod';
import { sideBetTypeSchema } from '../../schemas/casinoSchemas/sideBetTypeSchema';

export type SideBetType = z.infer<typeof sideBetTypeSchema>;
