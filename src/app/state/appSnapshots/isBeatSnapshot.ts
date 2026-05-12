import type { GameSnapshot } from '../../../game/types/GameSnapshot';

export const isBeatSnapshot = (snapshot: unknown): snapshot is GameSnapshot =>
  typeof snapshot === 'object' && snapshot !== null && 'bets' in snapshot && 'hands' in snapshot && 'dealer' in snapshot;
