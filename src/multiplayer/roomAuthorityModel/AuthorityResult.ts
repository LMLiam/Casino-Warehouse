import type { ConnectionId } from '../../schemas/casinoSchemas/ConnectionId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomSettlement } from '../protocol/RoomSettlement';
import type { RoomSocialEvent } from '../protocol/RoomSocialEvent';
import type { RoomSnapshot } from '../protocol/RoomSnapshot';
import type { RoomSummary } from '../protocol/RoomSummary';
import type { RoomBroadcastRecipients } from './RoomBroadcastRecipients';
import type { RoomClosure } from './RoomClosure';

export interface AuthorityResult {
  readonly broadcasts: readonly RoomSnapshot[];
  readonly settlements: readonly RoomSettlement[];
  readonly roomClosures?: readonly RoomClosure[];
  readonly broadcastRecipients?: readonly RoomBroadcastRecipients[];
  readonly direct?: RoomSnapshot;
  readonly roomList?: { readonly gameId: RoomGameId; readonly rooms: readonly RoomSummary[] };
  readonly socialEvent?: {
    readonly roomId: RoomId;
    readonly event: RoomSocialEvent;
    readonly connectionIds: readonly ConnectionId[];
  };
  readonly error?: string;
}
