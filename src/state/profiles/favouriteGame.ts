import type { CasinoGameId } from '../../game/ids';
import { roomGameIdSchema } from '../../schemas/casinoSchemas/roomGameIdSchema';
import type { PerGameStats } from './PerGameStats';

export const favouriteGame = (perGame: Readonly<Partial<Record<CasinoGameId, PerGameStats>>>): CasinoGameId | undefined => {
  const candidate = Object.entries(perGame).sort(([, left], [, right]) => right.gamesPlayed - left.gamesPlayed)[0]?.[0];
  return candidate === undefined ? undefined : roomGameIdSchema.parse(candidate);
};
