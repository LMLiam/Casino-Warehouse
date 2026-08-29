import { z } from 'zod';

export const connectionIdSchema = z.string().trim().min(1, 'Connection id is required.').max(128, 'Connection id is too long.').brand<'connection'>();
