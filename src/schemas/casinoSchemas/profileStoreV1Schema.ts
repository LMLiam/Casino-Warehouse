import { z } from 'zod';

export const profileStoreV1Schema = z.object({
  version: z.literal(1),
  profiles: z.array(z.unknown()),
});
