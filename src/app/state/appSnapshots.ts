import type { SlotSnapshot } from '../../game/slots';
import type { GameSnapshot } from '../../game/types';

export const totalOnTable = (snapshot: GameSnapshot): number =>
  Object.values(snapshot.bets).reduce((total, handBets) => total + Object.values(handBets).reduce((handTotal, amount) => handTotal + amount, 0), 0);

export const isBeatSnapshot = (snapshot: unknown): snapshot is GameSnapshot =>
  typeof snapshot === 'object' && snapshot !== null && 'bets' in snapshot && 'hands' in snapshot && 'dealer' in snapshot;

export const isSlotSnapshot = (snapshot: unknown): snapshot is SlotSnapshot =>
  typeof snapshot === 'object' && snapshot !== null && 'reels' in snapshot && 'themeId' in snapshot && 'bonusPicksRemaining' in snapshot;
