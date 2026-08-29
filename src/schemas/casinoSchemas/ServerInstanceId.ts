import type { z } from 'zod';
import { serverInstanceIdSchema } from './serverInstanceIdSchema';

export type ServerInstanceId = z.infer<typeof serverInstanceIdSchema>;
