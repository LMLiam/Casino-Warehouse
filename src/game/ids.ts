import type { z } from 'zod';
import { roomGameIdSchema } from '../schemas/casinoSchemas/roomGameIdSchema';

export type CasinoGameId = z.infer<typeof roomGameIdSchema>;
