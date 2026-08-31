import type { z } from 'zod';
import { blackjackTablePhaseSchema } from '../../schemas/casinoSchemas/blackjackTablePhaseSchema';

export type BlackjackTablePhase = z.infer<typeof blackjackTablePhaseSchema>;
