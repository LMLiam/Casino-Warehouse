import type { z } from 'zod';
import { blackjackResultSchema } from '../../schemas/casinoSchemas/blackjackResultSchema';

export type BlackjackResult = z.infer<typeof blackjackResultSchema>;
