import { z } from 'zod';
import { currentProfileStoreVersionSchema } from './currentProfileStoreVersionSchema';

export const casinoSaveStateEnvelopeSchema = z.object({
  version: currentProfileStoreVersionSchema,
  profiles: z.array(z.unknown()),
});
