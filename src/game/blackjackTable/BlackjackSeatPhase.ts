import type { z } from 'zod';
import { blackjackSeatPhaseSchema } from '../../schemas/casinoSchemas/blackjackSeatPhaseSchema';

export type BlackjackSeatPhase = z.infer<typeof blackjackSeatPhaseSchema>;
