import type { WebSocket } from 'ws';
import type { RoomGameId } from '../protocol/RoomGameId';

export interface Peer {
  readonly id: string;
  readonly socket: WebSocket;
  readonly ownedProfileIds: Set<string>;
  lastPongAt: number;
  browsingGameId?: RoomGameId;
  isAdmin: boolean;
}
