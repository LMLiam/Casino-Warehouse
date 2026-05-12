import type { RoomGameId } from '../protocol/RoomGameId';

export const maxRoomPlayers = (gameId: RoomGameId): number => (gameId === 'beat-the-house' ? 3 : gameId === 'blackjack' ? 5 : 4);
