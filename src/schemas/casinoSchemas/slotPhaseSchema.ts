import { z } from 'zod';

export const slotPhaseSchema = z.enum(['idle', 'spun', 'bonus']);
