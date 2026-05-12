import { z } from 'zod';
import { protocolVersionSchema } from './protocolVersionSchema';

export const casinoSaveStateEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  profiles: z.array(z.unknown()),
});
