import { defaultHouseAdvanceState } from './defaultHouseAdvanceState';
import { houseAdvanceConfig } from './houseAdvanceConfig';
import type { HouseAdvanceState } from './HouseAdvanceState';

export const normalizeHouseAdvanceState = (
  value:
    | {
        readonly outstandingBalance?: number | string | null;
        readonly activeCount?: number | string | null;
      }
    | null
    | undefined,
): HouseAdvanceState => {
  const safeMoney = (candidate: number | string | null | undefined): number => {
    const numericValue = typeof candidate === 'number' || typeof candidate === 'string' ? Number(candidate) : Number.NaN;
    return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
  };
  const safeCount = (candidate: number | string | null | undefined): number =>
    Math.min(houseAdvanceConfig.maxActiveCount, Math.max(0, Math.floor(safeMoney(candidate))));
  if (!value) {
    return defaultHouseAdvanceState;
  }

  const outstandingBalance = safeMoney(value.outstandingBalance);
  if (outstandingBalance <= 0) {
    return defaultHouseAdvanceState;
  }

  const activeCount = Math.max(1, safeCount(value.activeCount));
  return {
    outstandingBalance: Math.min(outstandingBalance, activeCount * houseAdvanceConfig.amount),
    activeCount,
  };
};
