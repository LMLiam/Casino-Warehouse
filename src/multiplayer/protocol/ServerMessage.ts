import type { z } from 'zod';
import { serverMessageSchema } from '../../schemas/protocol/serverMessageSchema';

export type ServerMessage = z.infer<typeof serverMessageSchema>;
