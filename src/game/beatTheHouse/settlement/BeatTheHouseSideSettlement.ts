import type { HalfUnits } from '../HalfUnits';
import type { BeatTheHouseSideWin } from './BeatTheHouseSideWin';

export type BeatTheHouseSideSettlement = {
  readonly wins: readonly BeatTheHouseSideWin[];
  readonly stakeHalfUnits: HalfUnits;
  readonly profitHalfUnits: HalfUnits;
  readonly returnedHalfUnits: HalfUnits;
};
