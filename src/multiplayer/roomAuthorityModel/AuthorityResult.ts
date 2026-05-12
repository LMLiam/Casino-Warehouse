import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomSettlement } from '../protocol/RoomSettlement';
import type { RoomSnapshot } from '../protocol/RoomSnapshot';
import type { RoomSummary } from '../protocol/RoomSummary';

export interface AuthorityResult {
  readonly broadcasts: readonly RoomSnapshot[];
  readonly settlements: readonly RoomSettlement[];
  readonly direct?: RoomSnapshot;
  readonly roomList?: { readonly gameId: RoomGameId; readonly rooms: readonly RoomSummary[] };
  readonly error?: string;
}
