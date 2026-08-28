import type { FreshShoeCounts } from './FreshShoeCounts';

export type FreshShoeDrawOutcome = {
  readonly kindIndex: number;
  readonly probability: number;
  readonly remainingCounts: FreshShoeCounts;
};
