import { z } from 'zod';

export const roomGameIdSchema = z.enum(['beat-the-house', 'blackjack', 'slots:thai-princess'], { error: 'Game id is invalid.' });
