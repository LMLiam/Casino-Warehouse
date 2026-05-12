import { z } from 'zod';

export const roomNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ' ').slice(0, 48))
  .optional();
