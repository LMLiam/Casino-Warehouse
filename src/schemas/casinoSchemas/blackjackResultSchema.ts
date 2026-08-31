import { z } from 'zod';

export const blackjackResultSchema = z.enum(['win', 'lose', 'push', 'blackjack']);
