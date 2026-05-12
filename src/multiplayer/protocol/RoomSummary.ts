import type { RoomGameId } from './RoomGameId';
import type { RoomStatus } from './RoomStatus';

export interface RoomSummary {
  readonly roomId: string;
  readonly roomName: string;
  readonly gameId: RoomGameId;
  readonly gameTitle: string;
  readonly hostProfileId: string;
  readonly maxPlayers: number;
  readonly currentPlayers: number;
  readonly spectators: number;
  readonly status: RoomStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
}
