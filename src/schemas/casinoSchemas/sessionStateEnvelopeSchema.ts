import { z } from 'zod';
import { currentSessionStateVersionSchema } from './currentSessionStateVersionSchema';

export const sessionStateEnvelopeSchema = z.object({
  version: currentSessionStateVersionSchema,
  profileIds: z.array(z.unknown()),
});
