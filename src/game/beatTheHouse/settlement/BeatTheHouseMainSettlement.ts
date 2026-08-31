import type { HandResult } from '../../types/HandResult';
import type { HalfUnits } from '../HalfUnits';

export type BeatTheHouseMainSettlement = {
  readonly result: HandResult;
  readonly stakeHalfUnits: HalfUnits;
  readonly profitHalfUnits: HalfUnits;
  readonly returnedHalfUnits: HalfUnits;
};
