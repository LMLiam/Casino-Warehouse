import type { z } from 'zod';
import { blackjackPhaseSchema } from '../../schemas/casinoSchemas/blackjackPhaseSchema';

export type BlackjackPhase = z.infer<typeof blackjackPhaseSchema>;
