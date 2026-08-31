import type { z } from 'zod';
import { profileTokenSchema } from './profileTokenSchema';

export type ProfileToken = z.infer<typeof profileTokenSchema>;
