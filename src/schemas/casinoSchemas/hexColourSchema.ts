import { z } from 'zod';

export const hexColourSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Colour must be a hex colour.')
  .brand<'hex-colour'>();
