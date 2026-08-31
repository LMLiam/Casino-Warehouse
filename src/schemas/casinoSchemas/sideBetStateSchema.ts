import { z } from 'zod';

export const sideBetStateSchema = z.enum(['win', 'lose', 'idle']);
