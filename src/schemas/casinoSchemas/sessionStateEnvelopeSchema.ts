import { z } from 'zod';
import { protocolVersionSchema } from './protocolVersionSchema';

export const sessionStateEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  profileIds: z.array(z.unknown()),
});
