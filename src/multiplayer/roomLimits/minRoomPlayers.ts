import type { RoomGameId } from '../protocol/RoomGameId';

export const minRoomPlayers = (gameId: RoomGameId): number => (gameId.startsWith('slots:') ? 2 : 1);
