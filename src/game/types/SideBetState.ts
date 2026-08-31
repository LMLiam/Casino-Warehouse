import type { z } from 'zod';
import { sideBetStateSchema } from '../../schemas/casinoSchemas/sideBetStateSchema';

export type SideBetState = z.infer<typeof sideBetStateSchema>;
