import type { BetType } from '../../types/BetType';
import type { FreshShoeCounts } from './FreshShoeCounts';

export type FreshShoeOracleOptions = {
  readonly counts?: FreshShoeCounts;
  readonly mainStake?: number;
  readonly sideBetRatios?: Partial<Record<Exclude<BetType, 'main'>, number>>;
};
