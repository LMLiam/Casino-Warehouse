import type { CasinoSaveState } from '../../state/profiles/CasinoSaveState';
import type { CasinoSessionState } from '../../state/session/CasinoSessionState';
import type { ServerDatabaseChoice } from '../../state/serverDataStore/ServerDatabaseChoice';
import type { ProfileToken } from '../../schemas/casinoSchemas/ProfileToken';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { ServerInstanceId } from '../../schemas/casinoSchemas/ServerInstanceId';
import type { SessionId } from '../../schemas/casinoSchemas/SessionId';
import type { RoomGameId } from './RoomGameId';
import type { RoomSettlement } from './RoomSettlement';
import type { RoomSnapshot } from './RoomSnapshot';
import type { RoomSummary } from './RoomSummary';

export type ServerMessage =
  | { readonly type: 'server-hello'; readonly serverInstanceId: ServerInstanceId }
  | { readonly type: 'reload-required'; readonly reason: 'server-restarted'; readonly message: string }
  | { readonly type: 'profile-credentials'; readonly profileId: ProfileId; readonly profileToken: ProfileToken }
  | { readonly type: 'profile-access'; readonly ownedProfileIds: readonly ProfileId[] }
  | { readonly type: 'admin-access'; readonly authorized: boolean }
  | {
      readonly type: 'data-state';
      readonly database: ServerDatabaseChoice;
      readonly profileState: CasinoSaveState;
      readonly session?: CasinoSessionState | undefined;
    }
  | { readonly type: 'heartbeat'; readonly sentAt: number }
  | { readonly type: 'room-created'; readonly room: RoomSnapshot; readonly invitePath: string }
  | { readonly type: 'room-closed'; readonly roomId: RoomId; readonly gameId: RoomGameId; readonly reason: string }
  | { readonly type: 'room-list'; readonly gameId: RoomGameId; readonly rooms: readonly RoomSummary[] }
  | { readonly type: 'room-state'; readonly room: RoomSnapshot }
  | { readonly type: 'settlement'; readonly roomId: RoomId; readonly sessionId: SessionId; readonly settlements: readonly RoomSettlement[] }
  | { readonly type: 'error'; readonly code: string; readonly message: string };
