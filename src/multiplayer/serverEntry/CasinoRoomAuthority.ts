import type { AuthorityResult } from '../roomAuthority';
import type { ClientMessage } from '../protocol/ClientMessage';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomSummary } from '../protocol/RoomSummary';

export interface CasinoRoomAuthority {
  setAsyncResultHandler?(handler: ((result: AuthorityResult) => void) | undefined): void;
  dispose?(): void;
  handle(connectionId: string, message: ClientMessage): AuthorityResult;
  disconnect(connectionId: string): AuthorityResult;
  removeProfile(profileId: string, reason: string): AuthorityResult;
  reconcileProfiles(reason: string): AuthorityResult;
  clearRooms(reason: string): AuthorityResult;
  listRoomSummaries(gameId?: RoomGameId): readonly RoomSummary[];
}
