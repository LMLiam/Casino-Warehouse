import { z } from 'zod';
import { profileIdSchema } from './profileIdSchema';

export const sessionStateV2Schema = z
  .object({
    version: z.literal(2),
    profileId: profileIdSchema,
  })
  .passthrough();
