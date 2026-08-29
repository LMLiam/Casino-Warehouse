import { z } from 'zod';

export const authTokenSchema = z.string().trim().min(1, 'Token is required.').max(256, 'Token is too long.');
