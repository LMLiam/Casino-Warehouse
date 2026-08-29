import { z } from 'zod';
import type { BlackjackTableSnapshot } from '../../game/blackjackTable/BlackjackTableSnapshot';
import { cardSchema } from './cardSchema';
import { blackjackResultSchema } from './blackjackResultSchema';
import { blackjackSeatIdSchema } from './blackjackSeatIdSchema';
import { blackjackSeatPhaseSchema } from './blackjackSeatPhaseSchema';
import { blackjackTablePhaseSchema } from './blackjackTablePhaseSchema';
import { profileIdSchema } from './profileIdSchema';

export const blackjackTableSnapshotSchema = (() => {
  const seat = z
    .object({
      seatId: blackjackSeatIdSchema,
      profileId: profileIdSchema.optional(),
      profileName: z.string().optional(),
      bankroll: z.number().finite().optional(),
      phase: blackjackSeatPhaseSchema,
      wager: z.number().finite(),
      playerCards: z.array(cardSchema),
      insuranceWager: z.number().finite(),
      splitHands: z.array(z.array(cardSchema)),
      result: blackjackResultSchema.optional(),
      returned: z.number().finite(),
      status: z.string(),
      isTurn: z.boolean(),
    })
    .strict();

  return z
    .object({
      kind: z.literal('blackjack-table'),
      phase: blackjackTablePhaseSchema,
      dealerCards: z.array(cardSchema),
      dealerHoleHidden: z.boolean(),
      activeSeatId: blackjackSeatIdSchema.optional(),
      seats: z.array(seat),
      status: z.string(),
    })
    .strict() satisfies z.ZodType<BlackjackTableSnapshot>;
})();
