import { z } from 'zod';

export const blackjackSeatIdSchema = z
  .string()
  .regex(/^seat-[1-9]\d*$/, 'Blackjack seat id is invalid.')
  .brand<'blackjack-seat'>();
