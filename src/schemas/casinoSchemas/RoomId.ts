import type { z } from 'zod';
import type { roomIdSchema } from './roomIdSchema';

export type RoomId = z.infer<typeof roomIdSchema>;
