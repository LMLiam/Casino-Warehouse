import { z } from 'zod';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import { betTypeSchema } from './betTypeSchema';
import { cardSchema } from './cardSchema';
import { gameEventTypeSchema } from './gameEventTypeSchema';
import { finiteNumberSchema } from './finiteNumberSchema';
import { handIdSchema } from './handIdSchema';
import { handResultSchema } from './handResultSchema';
import { phaseSchema } from './phaseSchema';
import { sideBetStateSchema } from './sideBetStateSchema';
import { sideBetTypeSchema } from './sideBetTypeSchema';
import { beatTheHouseShoeSnapshotSchema } from './beatTheHouseShoeSnapshotSchema';

export const gameSnapshotSchema = (() => {
  const bets = z.record(handIdSchema, z.record(betTypeSchema, finiteNumberSchema));
  const dealerTips = z.record(handIdSchema, finiteNumberSchema);
  const sideWin = z.object({ betType: sideBetTypeSchema, label: z.string(), profit: finiteNumberSchema, returned: finiteNumberSchema }).strict();
  const roundSummary = z
    .object({
      handId: handIdSchema,
      mainResult: handResultSchema,
      stake: finiteNumberSchema,
      returned: finiteNumberSchema,
      profit: finiteNumberSchema,
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
      amount: finiteNumberSchema.optional(),
      card: cardSchema.optional(),
      cardIndex: finiteNumberSchema.optional(),
      result: handResultSchema.optional(),
      summaries: z.array(roundSummary).optional(),
      totalProfit: finiteNumberSchema.optional(),
      dealerThanksTotal: finiteNumberSchema.optional(),
    })
    .strict();

  return z
    .object({
      phase: phaseSchema,
      bankroll: finiteNumberSchema,
      bets,
      dealerTips,
      dealerTipRewards: dealerTips,
      activeHand: handIdSchema.optional(),
      hands: z.record(handIdSchema, playerHand),
      dealer: dealerHand,
      shoe: beatTheHouseShoeSnapshotSchema,
      sideStates: z.record(handIdSchema, z.record(sideBetTypeSchema, sideBetStateSchema)),
      summaries: z.array(roundSummary),
      lastEvents: z.array(gameEvent),
      status: z.string(),
      canRebet: z.boolean(),
      rebetAmounts: z.record(handIdSchema, finiteNumberSchema),
    })
    .strict() satisfies z.ZodType<GameSnapshot>;
})();
