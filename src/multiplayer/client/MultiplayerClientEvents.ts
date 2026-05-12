import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomSettlement } from '../protocol/RoomSettlement';
import type { RoomSnapshot } from '../protocol/RoomSnapshot';
import type { RoomSummary } from '../protocol/RoomSummary';
import type { ServerMessage } from '../protocol/ServerMessage';
import type { RealtimeConnectionState } from './RealtimeConnectionState';
import type { ServerDataState } from './ServerDataState';

export interface MultiplayerClientEvents {
  readonly onStatus: (status: string) => void;
  readonly onConnectionState: (state: RealtimeConnectionState) => void;
  readonly onDataState: (state: ServerDataState) => void;
  readonly onProfileAccess: (ownedProfileIds: readonly string[]) => void;
  readonly onAdminAccess: (authorized: boolean) => void;
  readonly onRoom: (room: RoomSnapshot) => void;
  readonly onRoomCleared: () => void;
  readonly onRoomList: (gameId: RoomGameId, rooms: readonly RoomSummary[]) => void;
  readonly onSettlement: (settlements: readonly RoomSettlement[], room: Pick<ServerMessage & { type: 'settlement' }, 'roomId' | 'sessionId'>) => void;
  readonly onError: (message: string) => void;
}
