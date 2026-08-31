import type { z } from 'zod';
import type { profileIdSchema } from './profileIdSchema';

export type ProfileId = z.infer<typeof profileIdSchema>;
