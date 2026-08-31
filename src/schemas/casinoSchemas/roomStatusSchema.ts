import { z } from 'zod';

export const roomStatusSchema = z.enum(['waiting', 'betting', 'open', 'in-progress', 'settling', 'complete', 'closed']);
