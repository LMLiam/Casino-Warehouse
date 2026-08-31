import { beatTheHouseRules } from '../beatTheHouseRules';
import type { FreshShoeDecision } from './FreshShoeDecision';
import type { FreshShoeDealerDistribution } from './FreshShoeDealerDistribution';
import { drawFreshShoeKinds } from './drawFreshShoeKinds';
import { evaluateFreshShoeDealer } from './evaluateFreshShoeDealer';
import type { FreshShoePlayerState } from './FreshShoePlayerState';
import type { FreshShoeOracleContext } from './FreshShoeOracleContext';
import { freshShoeCardKinds } from './freshShoeCardKinds';

export const solveFreshShoePlayer = (
  state: FreshShoePlayerState,
  context: FreshShoeOracleContext,
  playerMemo: Map<string, FreshShoeDecision> = new Map(),
  dealerMemo: Map<string, FreshShoeDealerDistribution> = new Map(),
): FreshShoeDecision => {
  const playerCard = freshShoeCardKinds[state.playerFinalKind];
  const playerFirstCard = freshShoeCardKinds[state.playerFirstKind];
  if (!playerCard || !playerFirstCard || state.playerCardCount < 1 || state.playerCardCount > beatTheHouseRules.maximumPlayerCards) {
    throw new Error('Oracle player state is invalid.');
  }

  const contextKey = `${context.mainStake}|${Object.values(context.sideBetRatios).join(',')}`;
  const key = [contextKey, state.counts.join(','), state.playerFirstKind, state.playerFinalKind, state.playerCardCount].join('|');
  const cached = playerMemo.get(key);
  if (cached) {
    return cached;
  }

  const stickExpectedReturned = evaluateFreshShoeDealer(state.counts, state.playerFirstKind, state.playerFinalKind, 'compare', context, dealerMemo);
  if (state.playerCardCount >= beatTheHouseRules.maximumPlayerCards) {
    const decision: FreshShoeDecision = {
      action: 'stick',
      expectedReturned: stickExpectedReturned,
      hitExpectedReturned: stickExpectedReturned,
      stickExpectedReturned,
    };
    playerMemo.set(key, decision);
    return decision;
  }

  const hitExpectedReturned = drawFreshShoeKinds(state.counts).reduce((total, draw) => {
    const drawnCard = freshShoeCardKinds[draw.kindIndex];
    if (!drawnCard) {
      throw new Error('Oracle draw card kind is invalid.');
    }
    const nextCardCount = state.playerCardCount + 1;
    let continuation: number;
    if (drawnCard.rank === '2') {
      continuation = evaluateFreshShoeDealer(draw.remainingCounts, state.playerFirstKind, undefined, 'lose', context, dealerMemo);
    } else if (nextCardCount >= beatTheHouseRules.maximumPlayerCards) {
      continuation = evaluateFreshShoeDealer(draw.remainingCounts, state.playerFirstKind, draw.kindIndex, 'compare', context, dealerMemo);
    } else {
      continuation = solveFreshShoePlayer(
        {
          counts: draw.remainingCounts,
          playerFirstKind: state.playerFirstKind,
          playerFinalKind: draw.kindIndex,
          playerCardCount: nextCardCount,
        },
        context,
        playerMemo,
        dealerMemo,
      ).expectedReturned;
    }
    return total + draw.probability * continuation;
  }, 0);

  const action = hitExpectedReturned > stickExpectedReturned ? 'hit' : 'stick';
  const decision: FreshShoeDecision = {
    action,
    expectedReturned: action === 'hit' ? hitExpectedReturned : stickExpectedReturned,
    hitExpectedReturned,
    stickExpectedReturned,
  };
  playerMemo.set(key, decision);
  return decision;
};
