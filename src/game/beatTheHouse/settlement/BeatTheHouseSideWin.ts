import type { BetType } from '../../types/BetType';
import type { HalfUnits } from '../HalfUnits';

export type BeatTheHouseSideWin = {
  readonly betType: Exclude<BetType, 'main'>;
  readonly stakeHalfUnits: HalfUnits;
  readonly profitHalfUnits: HalfUnits;
  readonly returnedHalfUnits: HalfUnits;
};
