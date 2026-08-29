import { z } from 'zod';

export const serverInstanceIdSchema = z
  .string()
  .trim()
  .min(1, 'Server instance id is required.')
  .max(128, 'Server instance id is too long.')
  .brand<'server-instance'>();
