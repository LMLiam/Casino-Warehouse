import type { BetType } from './BetType';
import type { HalfUnits } from '../beatTheHouse/HalfUnits';

export interface SideWin {
  readonly betType: Exclude<BetType, 'main'>;
  readonly label: string;
  readonly returnedHalfUnits: HalfUnits;
  readonly profitHalfUnits: HalfUnits;
  readonly profit: number;
  readonly returned: number;
}
