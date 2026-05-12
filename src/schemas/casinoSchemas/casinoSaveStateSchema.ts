import { z } from 'zod';
import { casinoProfileSchema } from './casinoProfileSchema';
import { protocolVersionSchema } from './protocolVersionSchema';

export const casinoSaveStateSchema = z.object({
  version: protocolVersionSchema,
  profiles: z.array(casinoProfileSchema),
});
