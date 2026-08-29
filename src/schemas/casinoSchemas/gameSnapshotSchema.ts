import { z } from 'zod';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import { cardSchema } from './cardSchema';
import { betTypeSchema } from './betTypeSchema';
import { gameEventTypeSchema } from './gameEventTypeSchema';
import { handIdSchema } from './handIdSchema';
import { handResultSchema } from './handResultSchema';
import { phaseSchema } from './phaseSchema';
import { sideBetStateSchema } from './sideBetStateSchema';
import { sideBetTypeSchema } from './sideBetTypeSchema';

export const gameSnapshotSchema = (() => {
  const finiteNumber = z.number().finite();
  const bets = z.record(handIdSchema, z.record(betTypeSchema, finiteNumber));
  const dealerTips = z.record(handIdSchema, finiteNumber);
  const sideWin = z.object({ betType: sideBetTypeSchema, label: z.string(), profit: finiteNumber, returned: finiteNumber }).strict();
  const roundSummary = z
    .object({
      handId: handIdSchema,
      mainResult: handResultSchema,
      stake: finiteNumber,
      returned: finiteNumber,
      profit: finiteNumber,
      sideWins: z.array(sideWin),
    })
    .strict();
  const playerHand = z
    .object({
      id: handIdSchema,
      cards: z.array(cardSchema),
      done: z.boolean(),
      result: handResultSchema.optional(),
      automaticWin: z.boolean(),
      finalCard: cardSchema.optional(),
    })
    .strict();
  const dealerHand = z
    .object({
      cards: z.array(cardSchema),
      holeCard: cardSchema.optional(),
      holeRevealed: z.boolean(),
      bust: z.boolean(),
      blackAce: z.boolean(),
      finalCard: cardSchema.optional(),
    })
    .strict();
  const gameEvent = z
    .object({
      type: gameEventTypeSchema,
      message: z.string().optional(),
      handId: handIdSchema.optional(),
      betType: betTypeSchema.optional(),
      amount: finiteNumber.optional(),
      card: cardSchema.optional(),
      cardIndex: finiteNumber.optional(),
      result: handResultSchema.optional(),
      summaries: z.array(roundSummary).optional(),
      totalProfit: finiteNumber.optional(),
      dealerThanksTotal: finiteNumber.optional(),
    })
    .strict();

  return z
    .object({
      phase: phaseSchema,
      bankroll: finiteNumber,
      bets,
      dealerTips,
      dealerTipRewards: dealerTips,
      activeHand: handIdSchema.optional(),
      hands: z.record(handIdSchema, playerHand),
      dealer: dealerHand,
      sideStates: z.record(handIdSchema, z.record(sideBetTypeSchema, sideBetStateSchema)),
      summaries: z.array(roundSummary),
      lastEvents: z.array(gameEvent),
      status: z.string(),
      canRebet: z.boolean(),
      rebetAmounts: z.record(handIdSchema, finiteNumber),
    })
    .strict() satisfies z.ZodType<GameSnapshot>;
})();
