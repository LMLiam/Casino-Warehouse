import type { RoomGameId } from './RoomGameId';
import type { RoomStatus } from './RoomStatus';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';

export interface RoomSummary {
  readonly roomId: RoomId;
  readonly roomName: string;
  readonly gameId: RoomGameId;
  readonly gameTitle: string;
  readonly hostProfileId: ProfileId;
  readonly maxPlayers: number;
  readonly currentPlayers: number;
  readonly spectators: number;
  readonly status: RoomStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
}
