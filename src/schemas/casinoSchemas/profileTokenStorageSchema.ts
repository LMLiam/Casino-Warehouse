import { z } from 'zod';
import { profileIdSchema } from './profileIdSchema';
import { profileTokenSchema } from './profileTokenSchema';

export const profileTokenStorageSchema = z.array(
  z
    .object({
      profileId: profileIdSchema,
      profileToken: profileTokenSchema,
    })
    .strict(),
);
