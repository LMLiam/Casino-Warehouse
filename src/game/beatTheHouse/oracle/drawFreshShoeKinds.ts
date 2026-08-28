import type { FreshShoeCounts } from './FreshShoeCounts';
import type { FreshShoeDrawOutcome } from './FreshShoeDrawOutcome';
import { freshShoeCardKinds } from './freshShoeCardKinds';

export const drawFreshShoeKinds = (counts: FreshShoeCounts): readonly FreshShoeDrawOutcome[] => {
  if (counts.length !== freshShoeCardKinds.length || counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('Oracle card counts are invalid.');
  }

  const totalCards = counts.reduce((total, count) => total + count, 0);
  if (!Number.isSafeInteger(totalCards) || totalCards <= 0) {
    throw new Error('Oracle card counts are exhausted.');
  }

  return counts.flatMap((count, kindIndex) => {
    if (count === 0) {
      return [];
    }
    const remainingCounts = [...counts];
    remainingCounts[kindIndex] -= 1;
    return [{ kindIndex, probability: count / totalCards, remainingCounts }];
  });
};
