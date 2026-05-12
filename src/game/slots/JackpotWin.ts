import type { JackpotTier } from './JackpotTier';

export interface JackpotWin {
  readonly tier: JackpotTier;
  readonly label: string;
  readonly amount: number;
}
