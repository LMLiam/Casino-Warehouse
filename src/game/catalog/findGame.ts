import type { CasinoGameId } from '../ids';
import { gameCatalog } from './gameCatalog';
import type { GameCatalogEntry } from './GameCatalogEntry';

export const findGame = (gameId: CasinoGameId): GameCatalogEntry => gameCatalog.find((game) => game.id === gameId) ?? gameCatalog[0];
