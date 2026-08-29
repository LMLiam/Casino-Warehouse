import { z } from 'zod';

export const timeoutWithUnrefSchema = z
  .object({
    unref: z.function(),
  })
  .passthrough();
