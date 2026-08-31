import type { z } from 'zod';
import { gameEventTypeSchema } from '../../schemas/casinoSchemas/gameEventTypeSchema';

export type GameEventType = z.infer<typeof gameEventTypeSchema>;
