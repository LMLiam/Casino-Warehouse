import type { CasinoGameId } from '../../game/ids';
import { maxRoomPlayers } from '../../multiplayer/roomLimits/maxRoomPlayers';

export const defaultRoomMaxPlayers = (gameId: CasinoGameId): number => maxRoomPlayers(gameId);
