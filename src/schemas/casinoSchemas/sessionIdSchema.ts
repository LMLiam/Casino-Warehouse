import { z } from 'zod';

export const sessionIdSchema = z.string().trim().min(1, 'Session id is required.').max(128, 'Session id is too long.').brand<'session'>();
