import { z } from 'zod';

export const volumeSchema = z.coerce.number().finite().min(0).max(1);
