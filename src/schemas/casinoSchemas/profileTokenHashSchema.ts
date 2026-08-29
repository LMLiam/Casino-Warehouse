import { z } from 'zod';

export const profileTokenHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'Profile token hash is invalid.')
  .brand<'profile-token-hash'>();
