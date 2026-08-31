import { z } from 'zod';

export const handResultSchema = z.enum(['win', 'lose', 'push']);
