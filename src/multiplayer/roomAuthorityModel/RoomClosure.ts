import type { RoomGameId } from '../protocol/RoomGameId';

export interface RoomClosure {
  readonly roomId: string;
  readonly gameId: RoomGameId;
  readonly connectionIds: readonly string[];
  readonly reason: string;
}
