import type { z } from 'zod';
import { roomGameIdSchema } from '../../schemas/casinoSchemas/roomGameIdSchema';

export type RoomGameId = z.infer<typeof roomGameIdSchema>;
