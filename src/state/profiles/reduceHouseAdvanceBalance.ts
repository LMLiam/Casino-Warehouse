import { defaultHouseAdvanceState } from './defaultHouseAdvanceState';
import type { HouseAdvanceState } from './HouseAdvanceState';

export const reduceHouseAdvanceBalance = (state: HouseAdvanceState, repayment: number): HouseAdvanceState => {
  const outstandingBalance = Math.max(0, state.outstandingBalance - Math.max(0, Math.floor(repayment)));
  return outstandingBalance <= 0 ? defaultHouseAdvanceState : { ...state, outstandingBalance };
};
