import type { FreshShoeOracleContext } from './FreshShoeOracleContext';
import type { FreshShoeOracleOptions } from './FreshShoeOracleOptions';

export const createFreshShoeOracleContext = (options: FreshShoeOracleOptions): FreshShoeOracleContext => {
  const mainStake = options.mainStake ?? 1;
  if (!Number.isSafeInteger(mainStake) || mainStake <= 0) {
    throw new Error('Oracle main stake must be a positive safe integer.');
  }

  const sideBetRatios = {
    aceFlash: options.sideBetRatios?.aceFlash ?? 0,
    dealerBust: options.sideBetRatios?.dealerBust ?? 0,
    matchPush: options.sideBetRatios?.matchPush ?? 0,
    dealerSevens: options.sideBetRatios?.dealerSevens ?? 0,
  } as const;
  if (Object.values(sideBetRatios).some((ratio) => !Number.isFinite(ratio) || ratio < 0 || ratio > 1)) {
    throw new Error('Oracle side-bet ratios must be finite values from 0 through 1.');
  }

  return { mainStake, sideBetRatios };
};
