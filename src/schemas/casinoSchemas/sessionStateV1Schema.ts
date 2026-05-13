import { z } from 'zod';

export const sessionStateV1Schema = z
  .object({
    version: z.literal(1),
    profileIds: z.array(z.unknown()),
  })
  .passthrough();
