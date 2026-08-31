import type { CasinoGameId } from '../../game/ids';
import type { CasinoAsset } from './CasinoAsset';
import { casinoAssets } from './casinoAssets';

export const gameTileAsset = (gameId: CasinoGameId): CasinoAsset => casinoAssets.gameTiles[gameId];
