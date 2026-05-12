import type { AuthorityResult } from '../roomAuthority';
import type { ClientMessage } from '../protocol/ClientMessage';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomSummary } from '../protocol/RoomSummary';

export interface CasinoRoomAuthority {
  handle(connectionId: string, message: ClientMessage): AuthorityResult;
  disconnect(connectionId: string): AuthorityResult;
  listRoomSummaries(gameId?: RoomGameId): readonly RoomSummary[];
}
