import { z } from 'zod';
import { casinoProfileSchema } from './casinoProfileSchema';
import { currentProfileStoreVersionSchema } from './currentProfileStoreVersionSchema';

export const casinoSaveStateSchema = z.object({
  version: currentProfileStoreVersionSchema,
  profiles: z.array(casinoProfileSchema),
});
