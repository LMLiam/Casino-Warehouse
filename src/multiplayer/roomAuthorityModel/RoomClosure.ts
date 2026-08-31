import type { RoomGameId } from '../protocol/RoomGameId';
import type { ConnectionId } from '../../schemas/casinoSchemas/ConnectionId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';

export interface RoomClosure {
  readonly roomId: RoomId;
  readonly gameId: RoomGameId;
  readonly connectionIds: readonly ConnectionId[];
  readonly reason: string;
}
