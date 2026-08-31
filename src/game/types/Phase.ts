import type { z } from 'zod';
import { phaseSchema } from '../../schemas/casinoSchemas/phaseSchema';

export type Phase = z.infer<typeof phaseSchema>;
