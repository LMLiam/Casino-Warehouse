import { beatTheHouseRules } from '../beatTheHouseRules';
import type { FreshShoeCounts } from './FreshShoeCounts';
import type { FreshShoeDealerDistribution } from './FreshShoeDealerDistribution';
import { drawFreshShoeKinds } from './drawFreshShoeKinds';
import type { FreshShoeMainMode } from './FreshShoeMainMode';
import type { FreshShoeOracleContext } from './FreshShoeOracleContext';
import { freshShoeSettlement } from './freshShoeSettlement';
import type { FreshShoeDealerOutcome } from './FreshShoeDealerOutcome';
import { freshShoeCardKinds } from './freshShoeCardKinds';

export const evaluateFreshShoeDealer = (
  counts: FreshShoeCounts,
  playerFirstKind: number,
  playerFinalKind: number | undefined,
  mainMode: FreshShoeMainMode,
  context: FreshShoeOracleContext,
  memo: Map<string, FreshShoeDealerDistribution> = new Map(),
): number => {
  const distributionFor = (
    remainingCounts: FreshShoeCounts,
    dealerFirstKind: number,
    dealerCardCount: number,
    dealerFinalKind: number | undefined,
    bust: boolean,
    blackAce: boolean,
    sevenCount: number,
  ): FreshShoeDealerDistribution => {
    const key = [remainingCounts.join(','), dealerFirstKind, dealerCardCount, dealerFinalKind ?? -1, bust ? 1 : 0, blackAce ? 1 : 0, sevenCount].join('|');
    const cached = memo.get(key);
    if (cached) {
      return cached;
    }

    const dealerCard = freshShoeCardKinds[dealerFinalKind ?? dealerFirstKind];
    if (!dealerCard) {
      throw new Error('Oracle dealer card kind is invalid.');
    }

    if (bust || blackAce || dealerCard.value > beatTheHouseRules.dealerDrawMaximumRank || dealerCardCount >= beatTheHouseRules.maximumDealerCards) {
      const outcome: FreshShoeDealerOutcome = {
        firstKind: dealerFirstKind,
        finalKind: bust ? undefined : dealerFinalKind,
        bust,
        blackAce,
        sevenCount,
      };
      const terminal = [{ outcome, probability: 1 }];
      memo.set(key, terminal);
      return terminal;
    }

    const combined = new Map<string, { readonly outcome: FreshShoeDealerOutcome; readonly probability: number }>();
    for (const draw of drawFreshShoeKinds(remainingCounts)) {
      const drawnCard = freshShoeCardKinds[draw.kindIndex];
      if (!drawnCard) {
        throw new Error('Oracle draw card kind is invalid.');
      }
      const drawnBust = drawnCard.rank === '2';
      const continuation = distributionFor(
        draw.remainingCounts,
        dealerFirstKind,
        dealerCardCount + 1,
        drawnBust ? undefined : draw.kindIndex,
        drawnBust,
        false,
        sevenCount + (drawnCard.rank === '7' ? 1 : 0),
      );
      for (const branch of continuation) {
        const outcomeKey = [
          branch.outcome.firstKind,
          branch.outcome.finalKind ?? -1,
          branch.outcome.bust ? 1 : 0,
          branch.outcome.blackAce ? 1 : 0,
          branch.outcome.sevenCount,
        ].join('|');
        const previous = combined.get(outcomeKey);
        combined.set(outcomeKey, {
          outcome: branch.outcome,
          probability: (previous?.probability ?? 0) + draw.probability * branch.probability,
        });
      }
    }

    const result = [...combined.values()];
    memo.set(key, result);
    return result;
  };

  let distribution: FreshShoeDealerDistribution = [];
  for (const draw of drawFreshShoeKinds(counts)) {
    const dealerCard = freshShoeCardKinds[draw.kindIndex];
    if (!dealerCard) {
      throw new Error('Oracle draw card kind is invalid.');
    }
    const continuation = distributionFor(
      draw.remainingCounts,
      draw.kindIndex,
      1,
      dealerCard.rank === '2' ? undefined : draw.kindIndex,
      dealerCard.rank === '2',
      dealerCard.isBlackAce,
      dealerCard.rank === '7' ? 1 : 0,
    );
    distribution = [...distribution, ...continuation.map((branch) => ({ ...branch, probability: draw.probability * branch.probability }))];
  }

  return distribution.reduce(
    (total, branch) =>
      total +
      branch.probability *
        freshShoeSettlement({
          context,
          playerFirstKind,
          playerFinalKind,
          mainMode,
          dealer: branch.outcome,
        }),
    0,
  );
};
