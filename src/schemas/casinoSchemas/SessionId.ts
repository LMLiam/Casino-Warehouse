import type { z } from 'zod';
import { sessionIdSchema } from './sessionIdSchema';

export type SessionId = z.infer<typeof sessionIdSchema>;
