import type { z } from 'zod';
import { connectionIdSchema } from './connectionIdSchema';

export type ConnectionId = z.infer<typeof connectionIdSchema>;
