import { z } from 'zod';

export const profileNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ' ').slice(0, 32) || 'Player');
