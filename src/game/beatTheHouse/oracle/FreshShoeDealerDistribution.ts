import type { FreshShoeDealerOutcome } from './FreshShoeDealerOutcome';

export type FreshShoeDealerDistribution = readonly {
  readonly outcome: FreshShoeDealerOutcome;
  readonly probability: number;
}[];
