import { z } from 'zod';

export const volumeSchema = z.coerce.number().transform((value) => Math.max(0, Math.min(1, value)));
