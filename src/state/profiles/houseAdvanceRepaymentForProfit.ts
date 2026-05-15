import { houseAdvanceConfig } from './houseAdvanceConfig';
import type { HouseAdvanceState } from './HouseAdvanceState';

export const houseAdvanceRepaymentForProfit = (state: HouseAdvanceState, profit: number): number => {
  const netWinnings = Math.floor(profit);
  if (state.outstandingBalance <= 0 || netWinnings <= 0) {
    return 0;
  }
  return Math.min(state.outstandingBalance, Math.max(1, Math.floor(netWinnings * houseAdvanceConfig.repaymentPercent)));
};
