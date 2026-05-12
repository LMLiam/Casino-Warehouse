import type { BetType } from './BetType';

export interface SideWin {
  readonly betType: Exclude<BetType, 'main'>;
  readonly label: string;
  readonly profit: number;
  readonly returned: number;
}
