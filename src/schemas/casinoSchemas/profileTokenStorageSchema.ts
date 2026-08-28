import { z } from 'zod';

export const profileTokenStorageSchema = z.array(
  z
    .object({
      profileId: z.string().min(1),
      profileToken: z.string().min(1),
    })
    .strict(),
);
