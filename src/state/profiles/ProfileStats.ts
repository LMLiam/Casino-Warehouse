import type { PerGameStats } from './PerGameStats';

export interface ProfileStats {
  readonly totalWagered: number;
  readonly totalWon: number;
  readonly netProfit: number;
  readonly biggestWin: number;
  readonly biggestWager: number;
  readonly gamesPlayed: number;
  readonly perGame: Readonly<Record<string, PerGameStats>>;
  readonly favouriteGame?: string;
}
