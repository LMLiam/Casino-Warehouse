import { z } from 'zod';

export const profileIdSchema = z.string().trim().min(1, 'Profile id is required.').max(96, 'Profile id is too long.');
