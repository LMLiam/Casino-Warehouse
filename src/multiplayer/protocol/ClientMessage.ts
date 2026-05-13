import type { z } from 'zod';
import { clientMessageSchema } from '../../schemas/protocol/clientMessageSchema';

export type ClientMessage = z.infer<typeof clientMessageSchema>;
