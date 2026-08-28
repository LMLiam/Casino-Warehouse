import type { CasinoGameId } from '../ids';
import { gameCatalog } from './gameCatalog';
import type { GameCatalogEntry } from './GameCatalogEntry';

export const findGame = (gameId: CasinoGameId): GameCatalogEntry => {
  const found = gameCatalog.find((game) => game.id === gameId);
  if (found) {
    return found;
  }
  const fallback = gameCatalog[0];
  if (!fallback) {
    throw new Error('Game catalog is empty.');
  }
  return fallback;
};
