import { z } from 'zod';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import { betTypes } from '../../game/types/betTypes';
import { handIds } from '../../game/types/handIds';
import { cardSchema } from './cardSchema';

export const gameSnapshotSchema = (() => {
  const finiteNumber = z.number().finite();
  const handId = z.enum(handIds);
  const betType = z.enum(betTypes);
  const sideBetType = z.enum(['aceFlash', 'dealerBust', 'matchPush', 'dealerSevens']);
  const handResult = z.enum(['win', 'lose', 'push']);
  const bets = z.record(handId, z.record(betType, finiteNumber));
  const dealerTips = z.record(handId, finiteNumber);
  const sideWin = z.object({ betType: sideBetType, label: z.string(), profit: finiteNumber, returned: finiteNumber }).strict();
  const roundSummary = z
    .object({
      handId,
      mainResult: handResult,
      stake: finiteNumber,
      returned: finiteNumber,
      profit: finiteNumber,
      sideWins: z.array(sideWin),
    })
    .strict();
  const playerHand = z
    .object({
      id: handId,
      cards: z.array(cardSchema),
      done: z.boolean(),
      result: handResult.optional(),
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
      type: z.enum([
        'bet-placed',
        'dealer-tip-placed',
        'dealer-tip-taken',
        'bets-cleared',
        'round-started',
        'player-card',
        'dealer-hole',
        'dealer-card',
        'hand-completed',
        'round-settled',
        'message',
      ]),
      message: z.string().optional(),
      handId: handId.optional(),
      betType: betType.optional(),
      amount: finiteNumber.optional(),
      card: cardSchema.optional(),
      cardIndex: finiteNumber.optional(),
      result: handResult.optional(),
      summaries: z.array(roundSummary).optional(),
      totalProfit: finiteNumber.optional(),
      dealerThanksTotal: finiteNumber.optional(),
    })
    .strict();

  return z
    .object({
      phase: z.enum(['betting', 'dealing', 'playing', 'dealer', 'roundOver']),
      bankroll: finiteNumber,
      bets,
      dealerTips,
      dealerTipRewards: dealerTips,
      activeHand: handId.optional(),
      hands: z.record(handId, playerHand),
      dealer: dealerHand,
      sideStates: z.record(handId, z.record(sideBetType, z.enum(['win', 'lose', 'idle']))),
      summaries: z.array(roundSummary),
      lastEvents: z.array(gameEvent),
      status: z.string(),
      canRebet: z.boolean(),
      rebetAmounts: z.record(handId, finiteNumber),
    })
    .strict() satisfies z.ZodType<GameSnapshot>;
})();
