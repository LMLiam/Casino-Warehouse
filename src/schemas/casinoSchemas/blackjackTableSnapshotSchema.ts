import { z } from 'zod';
import type { BlackjackTableSnapshot } from '../../game/blackjackTable/BlackjackTableSnapshot';
import { cardSchema } from './cardSchema';

export const blackjackTableSnapshotSchema = (() => {
  const result = z.enum(['win', 'lose', 'push', 'blackjack']);
  const seat = z
    .object({
      seatId: z.string(),
      profileId: z.string().optional(),
      profileName: z.string().optional(),
      bankroll: z.number().finite().optional(),
      phase: z.enum(['empty', 'betting', 'player', 'stood', 'settled']),
      wager: z.number().finite(),
      playerCards: z.array(cardSchema),
      insuranceWager: z.number().finite(),
      splitHands: z.array(z.array(cardSchema)),
      result: result.optional(),
      returned: z.number().finite(),
      status: z.string(),
      isTurn: z.boolean(),
    })
    .strict();

  return z
    .object({
      kind: z.literal('blackjack-table'),
      phase: z.enum(['betting', 'playing', 'settled']),
      dealerCards: z.array(cardSchema),
      dealerHoleHidden: z.boolean(),
      activeSeatId: z.string().optional(),
      seats: z.array(seat),
      status: z.string(),
    })
    .strict() satisfies z.ZodType<BlackjackTableSnapshot>;
})();
