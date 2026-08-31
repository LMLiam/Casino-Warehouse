import type { z } from 'zod';
import { blackjackSeatIdSchema } from './blackjackSeatIdSchema';

export type BlackjackSeatId = z.infer<typeof blackjackSeatIdSchema>;
