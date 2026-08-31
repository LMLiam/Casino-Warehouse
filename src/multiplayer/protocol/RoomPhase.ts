import type { z } from 'zod';
import { roomPhaseSchema } from '../../schemas/casinoSchemas/roomPhaseSchema';

export type RoomPhase = z.infer<typeof roomPhaseSchema>;
