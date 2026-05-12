import type { HandId } from './HandId';
import type { HandResult } from './HandResult';
import type { SideWin } from './SideWin';

export interface RoundSummary {
  readonly handId: HandId;
  readonly mainResult: HandResult;
  readonly stake: number;
  readonly returned: number;
  readonly profit: number;
  readonly sideWins: SideWin[];
}
