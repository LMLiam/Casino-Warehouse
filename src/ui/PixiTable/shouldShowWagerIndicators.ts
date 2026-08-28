import type { GameSnapshot } from '../../game/types/GameSnapshot';

export const shouldShowWagerIndicators = (snapshot: GameSnapshot): boolean => {
  const wagerIndicatorPhases: readonly GameSnapshot['phase'][] = ['betting', 'dealing', 'playing', 'dealer'];
  return wagerIndicatorPhases.includes(snapshot.phase);
};
