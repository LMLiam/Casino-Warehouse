import type { BetType } from '../../types/BetType';

export type FreshShoeOracleContext = {
  readonly mainStake: number;
  readonly sideBetRatios: Readonly<Record<Exclude<BetType, 'main'>, number>>;
};
