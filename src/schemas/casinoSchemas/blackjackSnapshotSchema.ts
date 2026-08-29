import { z } from 'zod';
import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import { cardSchema } from './cardSchema';
import { blackjackResultSchema } from './blackjackResultSchema';
import { blackjackPhaseSchema } from './blackjackPhaseSchema';

export const blackjackSnapshotSchema = z
  .object({
    phase: blackjackPhaseSchema,
    wager: z.number().finite(),
    playerCards: z.array(cardSchema),
    dealerCards: z.array(cardSchema),
    dealerHoleHidden: z.boolean(),
    insuranceWager: z.number().finite(),
    splitHands: z.array(z.array(cardSchema)),
    result: blackjackResultSchema.optional(),
    returned: z.number().finite(),
    status: z.string(),
  })
  .strict() satisfies z.ZodType<BlackjackSnapshot>;
