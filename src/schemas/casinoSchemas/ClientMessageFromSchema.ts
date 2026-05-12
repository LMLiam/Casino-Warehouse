import { z } from 'zod';
import { clientMessageSchema } from './clientMessageSchema';

export type ClientMessageFromSchema = z.infer<typeof clientMessageSchema>;
