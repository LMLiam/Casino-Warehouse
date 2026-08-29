import type { z } from 'zod';
import { roomReadyPhaseSchema } from '../../schemas/casinoSchemas/roomReadyPhaseSchema';

export type RoomReadyPhase = z.infer<typeof roomReadyPhaseSchema>;
