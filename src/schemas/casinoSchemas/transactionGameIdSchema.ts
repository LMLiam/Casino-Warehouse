import { z } from 'zod';
import { roomGameIdSchema } from './roomGameIdSchema';

export const transactionGameIdSchema = z.union([roomGameIdSchema, z.literal('admin'), z.literal('house-advance')]);
