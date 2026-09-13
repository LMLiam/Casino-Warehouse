import type { z } from 'zod';
import type { roomReactionSchema } from '../../schemas/casinoSchemas/roomReactionSchema';

export type RoomReaction = z.infer<typeof roomReactionSchema>;
