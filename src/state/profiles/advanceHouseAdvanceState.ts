import { houseAdvanceConfig } from './houseAdvanceConfig';
import type { HouseAdvanceState } from './HouseAdvanceState';

export const advanceHouseAdvanceState = (state: HouseAdvanceState): HouseAdvanceState => ({
  outstandingBalance: state.outstandingBalance + houseAdvanceConfig.amount,
  activeCount: state.activeCount + 1,
});
