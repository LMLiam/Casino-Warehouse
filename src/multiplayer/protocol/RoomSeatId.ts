import type { z } from 'zod';
import { roomSeatIdSchema } from '../../schemas/casinoSchemas/roomSeatIdSchema';

export type RoomSeatId = z.infer<typeof roomSeatIdSchema>;
