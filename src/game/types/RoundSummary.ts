import type { HandId } from './HandId';
import type { HandResult } from './HandResult';
import type { SideWin } from './SideWin';
import type { HalfUnits } from '../beatTheHouse/HalfUnits';

export interface RoundSummary {
  readonly handId: HandId;
  readonly mainResult: HandResult;
  readonly stake: number;
  readonly mainProfitHalfUnits: HalfUnits;
  readonly sideProfitHalfUnits: HalfUnits;
  readonly returnedHalfUnits: HalfUnits;
  readonly profitHalfUnits: HalfUnits;
  readonly returned: number;
  readonly profit: number;
  readonly sideWins: SideWin[];
}
