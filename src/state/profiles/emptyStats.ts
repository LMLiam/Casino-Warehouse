import type { ProfileStats } from './ProfileStats';

export const emptyStats = (): ProfileStats => ({
  totalWagered: 0,
  totalWon: 0,
  netProfit: 0,
  biggestWin: 0,
  biggestWager: 0,
  gamesPlayed: 0,
  perGame: {},
});
