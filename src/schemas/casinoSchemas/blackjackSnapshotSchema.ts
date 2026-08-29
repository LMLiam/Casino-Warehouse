import { z } from 'zod';
import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import { cardSchema } from './cardSchema';
import { blackjackResultSchema } from './blackjackResultSchema';
import { blackjackPhaseSchema } from './blackjackPhaseSchema';
import { finiteNumberSchema } from './finiteNumberSchema';

export const blackjackSnapshotSchema = z
  .object({
    phase: blackjackPhaseSchema,
    wager: finiteNumberSchema,
    playerCards: z.array(cardSchema),
    dealerCards: z.array(cardSchema),
    dealerHoleHidden: z.boolean(),
    insuranceWager: finiteNumberSchema,
    splitHands: z.array(z.array(cardSchema)),
    result: blackjackResultSchema.optional(),
    returned: finiteNumberSchema,
    status: z.string(),
  })
  .strict() satisfies z.ZodType<BlackjackSnapshot>;
