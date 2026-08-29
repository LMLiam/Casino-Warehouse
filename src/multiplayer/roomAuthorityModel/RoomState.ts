import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { HandId } from '../../game/types/HandId';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomPlayer } from '../protocol/RoomPlayer';
import type { RoomRole } from '../protocol/RoomRole';
import type { RoomSeatId } from '../protocol/RoomSeatId';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { ConnectionId } from '../../schemas/casinoSchemas/ConnectionId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { SessionId } from '../../schemas/casinoSchemas/SessionId';
import type { GameModel } from './GameModel';

export interface RoomState {
  readonly roomId: RoomId;
  readonly roomName: string;
  readonly gameId: RoomGameId;
  readonly gameTitle: string;
  readonly hostProfileId: ProfileId;
  readonly maxPlayers: number;
  readonly allowSpectators: boolean;
  readonly players: Map<ProfileId, RoomPlayer>;
  readonly spectators: Map<ProfileId, RoomPlayer>;
  readonly connectionToMember: Map<ConnectionId, { readonly profileId: ProfileId; readonly role: RoomRole }>;
  readonly seats: Map<RoomSeatId, ProfileId>;
  readonly model: GameModel;
  readonly createdAt: number;
  updatedAt: number;
  sessionId: SessionId;
  revision: number;
  readonly serverManaged: boolean;
  settledSessionIds: Set<SessionId>;
  lastBeatEvents: GameSnapshot['lastEvents'];
  lastBeatBetOwners: Partial<Record<HandId, ProfileId>>;
}
