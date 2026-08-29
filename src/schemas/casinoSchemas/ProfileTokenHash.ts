import type { z } from 'zod';
import { profileTokenHashSchema } from './profileTokenHashSchema';

export type ProfileTokenHash = z.infer<typeof profileTokenHashSchema>;
