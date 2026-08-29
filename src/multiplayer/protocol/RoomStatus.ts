import type { z } from 'zod';
import { roomStatusSchema } from '../../schemas/casinoSchemas/roomStatusSchema';

export type RoomStatus = z.infer<typeof roomStatusSchema>;
