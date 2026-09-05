import { z } from 'zod';
import { asHalfUnits } from '../../game/beatTheHouse/asHalfUnits';
import { asNonNegativeHalfUnits } from '../../game/beatTheHouse/asNonNegativeHalfUnits';
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
  const returnedHalfUnits = z.int().nonnegative().transform(asNonNegativeHalfUnits);
  const profitHalfUnits = z.int().transform(asHalfUnits);
  const sideWin = z
    .object({
      betType: sideBetTypeSchema,
      label: z.string(),
      returnedHalfUnits,
      profitHalfUnits,
      profit: finiteNumberSchema,
      returned: finiteNumberSchema,
    })
    .strict()
    .refine(
      (value) => value.returned === value.returnedHalfUnits / 2 && value.profit === value.profitHalfUnits / 2,
      'Side win display values must derive from half-units.',
    );
  const roundSummary = z
    .object({
      handId: handIdSchema,
      mainResult: handResultSchema,
      stake: finiteNumberSchema,
      mainProfitHalfUnits: profitHalfUnits,
      sideProfitHalfUnits: profitHalfUnits,
      returnedHalfUnits,
      profitHalfUnits,
      returned: finiteNumberSchema,
      profit: finiteNumberSchema,
      sideWins: z.array(sideWin),
    })
    .strict()
    .refine(
      (value) =>
        value.returned === value.returnedHalfUnits / 2 &&
        value.profit === value.profitHalfUnits / 2 &&
        value.profitHalfUnits === value.mainProfitHalfUnits + value.sideProfitHalfUnits &&
        value.returnedHalfUnits === value.stake * 2 + value.profitHalfUnits,
      'Round summary values must conserve exact half-units.',
    );
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
      totalProfitHalfUnits: profitHalfUnits.optional(),
      totalProfit: finiteNumberSchema.optional(),
      dealerThanksTotal: finiteNumberSchema.optional(),
    })
    .strict()
    .refine(
      (value) => value.totalProfitHalfUnits === undefined || value.totalProfit === value.totalProfitHalfUnits / 2,
      'Round total display value must derive from half-units.',
    );

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
