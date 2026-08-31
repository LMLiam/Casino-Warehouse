import type { FreshShoeOracleOptions } from './FreshShoeOracleOptions';
import { createFreshShoeCounts } from './createFreshShoeCounts';
import { createFreshShoeOracleContext } from './createFreshShoeOracleContext';
import { drawFreshShoeKinds } from './drawFreshShoeKinds';
import { evaluateFreshShoeDealer } from './evaluateFreshShoeDealer';
import { freshShoeCardKinds } from './freshShoeCardKinds';
import type { FreshShoeOracleResult } from './FreshShoeOracleResult';
import { solveFreshShoePlayer } from './solveFreshShoePlayer';

export const solveFreshShoe = (options: FreshShoeOracleOptions = {}): FreshShoeOracleResult => {
  const context = createFreshShoeOracleContext(options);
  const counts = options.counts ?? createFreshShoeCounts();
  const playerMemo = new Map();
  const dealerMemo = new Map();
  const expectedReturned = drawFreshShoeKinds(counts).reduce((total, draw) => {
    const playerCard = freshShoeCardKinds[draw.kindIndex];
    if (!playerCard) {
      throw new Error('Oracle draw card kind is invalid.');
    }

    const returned =
      playerCard.rank === '2'
        ? evaluateFreshShoeDealer(draw.remainingCounts, draw.kindIndex, undefined, 'lose', context, dealerMemo)
        : playerCard.isBlackAce
          ? evaluateFreshShoeDealer(draw.remainingCounts, draw.kindIndex, undefined, 'automaticWin', context, dealerMemo)
          : solveFreshShoePlayer(
              {
                counts: draw.remainingCounts,
                playerFirstKind: draw.kindIndex,
                playerFinalKind: draw.kindIndex,
                playerCardCount: 1,
              },
              context,
              playerMemo,
              dealerMemo,
            ).expectedReturned;
    return total + draw.probability * returned;
  }, 0);
  const totalStake = context.mainStake * (1 + Object.values(context.sideBetRatios).reduce((total, ratio) => total + ratio, 0));

  return { expectedReturned, expectedProfit: expectedReturned - totalStake, totalStake };
};
