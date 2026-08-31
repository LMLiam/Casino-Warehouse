import type { WebSocket } from 'ws';
import type { ConnectionId } from '../../schemas/casinoSchemas/ConnectionId';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomGameId } from '../protocol/RoomGameId';

export interface Peer {
  readonly id: ConnectionId;
  readonly socket: WebSocket;
  readonly ownedProfileIds: Set<ProfileId>;
  lastPongAt: number;
  browsingGameId?: RoomGameId;
  isAdmin: boolean;
}
