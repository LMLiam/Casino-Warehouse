import { defaultHouseAdvanceState } from './defaultHouseAdvanceState';
import { houseAdvanceConfig } from './houseAdvanceConfig';
import type { HouseAdvanceState } from './HouseAdvanceState';

export const normalizeHouseAdvanceState = (value: unknown): HouseAdvanceState => {
  const safeMoney = (candidate: unknown): number => (Number.isFinite(candidate) ? Math.max(0, Math.floor(Number(candidate))) : 0);
  const safeCount = (candidate: unknown): number =>
    Number.isFinite(candidate) ? Math.min(houseAdvanceConfig.maxActiveCount, Math.max(0, Math.floor(Number(candidate)))) : 0;
  const isRecord = (candidate: unknown): candidate is Record<string, unknown> => typeof candidate === 'object' && candidate !== null;
  if (!isRecord(value)) {
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
