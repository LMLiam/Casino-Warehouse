import type { RoomGameId } from '../protocol/RoomGameId';
import { maxRoomPlayers } from './maxRoomPlayers';
import { minRoomPlayers } from './minRoomPlayers';

export const normalizeRoomMaxPlayers = (gameId: RoomGameId, requested?: number): number => {
  const maximum = maxRoomPlayers(gameId);
  const fallback = maximum;
  return Math.max(minRoomPlayers(gameId), Math.min(maximum, requested && requested > 0 ? Math.floor(requested) : fallback));
};
