import { z } from 'zod';
import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import { cardSchema } from './cardSchema';

export const blackjackSnapshotSchema = z
  .object({
    phase: z.enum(['idle', 'player', 'dealer', 'settled']),
    wager: z.number().finite(),
    playerCards: z.array(cardSchema),
    dealerCards: z.array(cardSchema),
    dealerHoleHidden: z.boolean(),
    insuranceWager: z.number().finite(),
    splitHands: z.array(z.array(cardSchema)),
    result: z.enum(['win', 'lose', 'push', 'blackjack']).optional(),
    returned: z.number().finite(),
    status: z.string(),
  })
  .strict() satisfies z.ZodType<BlackjackSnapshot>;
