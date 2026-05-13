import type { PerGameStats } from './PerGameStats';

export const favouriteGame = (perGame: Readonly<Record<string, PerGameStats>>): string | undefined =>
  Object.entries(perGame).sort(([, left], [, right]) => right.gamesPlayed - left.gamesPlayed)[0]?.[0];
