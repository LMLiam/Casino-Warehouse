import type { CasinoGameId } from '../../game/catalog';
import { maxRoomPlayers } from '../../multiplayer/roomLimits';

export const defaultRoomMaxPlayers = (gameId: CasinoGameId): number => maxRoomPlayers(gameId);
