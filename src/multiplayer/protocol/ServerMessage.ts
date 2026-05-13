import type { CasinoSaveState } from '../../state/profiles/CasinoSaveState';
import type { CasinoSessionState } from '../../state/session/CasinoSessionState';
import type { ServerDatabaseChoice } from '../../state/serverDataStore/ServerDatabaseChoice';
import type { currentProtocolVersion } from './currentProtocolVersion';
import type { RoomGameId } from './RoomGameId';
import type { RoomSettlement } from './RoomSettlement';
import type { RoomSnapshot } from './RoomSnapshot';
import type { RoomSummary } from './RoomSummary';

export type ServerMessage =
  | { readonly version: typeof currentProtocolVersion; readonly type: 'server-hello'; readonly serverInstanceId: string }
  | { readonly version: typeof currentProtocolVersion; readonly type: 'reload-required'; readonly reason: 'server-restarted'; readonly message: string }
  | { readonly version: typeof currentProtocolVersion; readonly type: 'profile-credentials'; readonly profileId: string; readonly profileToken: string }
  | { readonly version: typeof currentProtocolVersion; readonly type: 'profile-access'; readonly ownedProfileIds: readonly string[] }
  | { readonly version: typeof currentProtocolVersion; readonly type: 'admin-access'; readonly authorized: boolean }
  | {
      readonly version: typeof currentProtocolVersion;
      readonly type: 'data-state';
      readonly database: ServerDatabaseChoice;
      readonly profileState: CasinoSaveState;
      readonly session?: CasinoSessionState;
    }
  | { readonly version: typeof currentProtocolVersion; readonly type: 'heartbeat'; readonly sentAt: number }
  | { readonly version: typeof currentProtocolVersion; readonly type: 'room-created'; readonly room: RoomSnapshot; readonly invitePath: string }
  | {
      readonly version: typeof currentProtocolVersion;
      readonly type: 'room-closed';
      readonly roomId: string;
      readonly gameId: RoomGameId;
      readonly reason: string;
    }
  | { readonly version: typeof currentProtocolVersion; readonly type: 'room-list'; readonly gameId: RoomGameId; readonly rooms: readonly RoomSummary[] }
  | { readonly version: typeof currentProtocolVersion; readonly type: 'room-state'; readonly room: RoomSnapshot }
  | {
      readonly version: typeof currentProtocolVersion;
      readonly type: 'settlement';
      readonly roomId: string;
      readonly sessionId: string;
      readonly settlements: readonly RoomSettlement[];
    }
  | { readonly version: typeof currentProtocolVersion; readonly type: 'error'; readonly code: string; readonly message: string };
