import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { ConnectionId } from '../../schemas/casinoSchemas/ConnectionId';

export interface RoomBroadcastRecipients {
  readonly roomId: RoomId;
  readonly connectionIds: readonly ConnectionId[];
}
