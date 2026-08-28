import { z } from 'zod';
import { profileIdSchema } from './profileIdSchema';

export const profileTokenStorageSchema = z.union([
  z.array(
    z.object({
      profileId: profileIdSchema,
      profileToken: z.string().trim().min(1).max(256),
    }),
  ),
  z.record(z.string(), z.string()),
]);
