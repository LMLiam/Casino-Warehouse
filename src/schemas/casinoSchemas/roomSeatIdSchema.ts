import { z } from 'zod';
import { blackjackSeatIdSchema } from './blackjackSeatIdSchema';
import { handIdSchema } from './handIdSchema';

export const roomSeatIdSchema = z.union([handIdSchema, blackjackSeatIdSchema], { error: 'Seat id is invalid.' });
