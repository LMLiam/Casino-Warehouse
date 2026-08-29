import type { z } from 'zod';
import { slotPhaseSchema } from '../../schemas/casinoSchemas/slotPhaseSchema';

export type SlotPhase = z.infer<typeof slotPhaseSchema>;
