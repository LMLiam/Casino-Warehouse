import { z } from 'zod';

export const settlementIdSchema = z.string().trim().min(1, 'Settlement id is required.').max(128, 'Settlement id is too long.').brand<'settlement'>();
