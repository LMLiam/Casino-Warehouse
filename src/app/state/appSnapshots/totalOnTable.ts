import type { GameSnapshot } from '../../../game/types/GameSnapshot';

export const totalOnTable = (snapshot: GameSnapshot): number =>
  Object.values(snapshot.bets).reduce((total, handBets) => total + Object.values(handBets).reduce((handTotal, amount) => handTotal + amount, 0), 0) +
  Object.values(snapshot.dealerTips).reduce((total, amount) => total + amount, 0);
