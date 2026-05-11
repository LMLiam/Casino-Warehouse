import type { RoomGameId } from './protocol';

export const maxRoomPlayers = (gameId: RoomGameId): number => (gameId === 'beat-the-house' ? 3 : gameId === 'blackjack' ? 5 : 4);

export const minRoomPlayers = (gameId: RoomGameId): number => (gameId.startsWith('slots:') ? 2 : 1);

export const normalizeRoomMaxPlayers = (gameId: RoomGameId, requested?: number): number => {
  const maximum = maxRoomPlayers(gameId);
  const fallback = maximum;
  return Math.max(minRoomPlayers(gameId), Math.min(maximum, requested && requested > 0 ? Math.floor(requested) : fallback));
};
