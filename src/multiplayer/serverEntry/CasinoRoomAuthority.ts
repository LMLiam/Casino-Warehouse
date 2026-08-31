import type { AuthorityResult } from '../roomAuthority';
import type { ConnectionId } from '../../schemas/casinoSchemas/ConnectionId';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { ClientMessage } from '../protocol/ClientMessage';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomSummary } from '../protocol/RoomSummary';

export interface CasinoRoomAuthority {
  setAsyncResultHandler?(handler: ((result: AuthorityResult) => void) | undefined): void;
  dispose?(): void;
  handle(connectionId: ConnectionId, message: ClientMessage): AuthorityResult;
  disconnect(connectionId: ConnectionId): AuthorityResult;
  removeProfile(profileId: ProfileId, reason: string): AuthorityResult;
  reconcileProfiles(reason: string): AuthorityResult;
  clearRooms(reason: string): AuthorityResult;
  listRoomSummaries(gameId?: RoomGameId): readonly RoomSummary[];
}
