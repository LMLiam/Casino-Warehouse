import { z } from 'zod';

export const roomIdSchema = z
  .string()
  .trim()
  .min(1, 'Room id is required.')
  .max(64, 'Room id is too long.')
  .transform((value) => value.toUpperCase())
  .brand<'room'>();
