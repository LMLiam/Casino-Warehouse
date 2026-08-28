import { z } from 'zod';
import { profileIdSchema } from './profileIdSchema';

export const sessionStateV3Schema = z
  .object({
    version: z.literal(3),
    profileId: profileIdSchema,
  })
  .passthrough();
