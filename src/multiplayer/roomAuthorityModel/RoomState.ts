import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomPlayer } from '../protocol/RoomPlayer';
import type { RoomRole } from '../protocol/RoomRole';
import type { RoomSeatId } from '../protocol/RoomSeatId';
import type { GameModel } from './GameModel';

export interface RoomState {
  readonly roomId: string;
  readonly roomName: string;
  readonly gameId: RoomGameId;
  readonly gameTitle: string;
  readonly hostProfileId: string;
  readonly maxPlayers: number;
  readonly allowSpectators: boolean;
  readonly players: Map<string, RoomPlayer>;
  readonly spectators: Map<string, RoomPlayer>;
  readonly connectionToMember: Map<string, { readonly profileId: string; readonly role: RoomRole }>;
  readonly seats: Map<RoomSeatId, string>;
  readonly model: GameModel;
  readonly createdAt: number;
  updatedAt: number;
  sessionId: string;
  revision: number;
  readonly serverManaged: boolean;
  settledSessionIds: Set<string>;
  lastBeatEvents: GameSnapshot['lastEvents'];
}
