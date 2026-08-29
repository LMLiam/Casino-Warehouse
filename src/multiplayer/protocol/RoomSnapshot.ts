import type { HandId } from '../../game/types/HandId';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { SessionId } from '../../schemas/casinoSchemas/SessionId';
import type { RoomGameId } from './RoomGameId';
import type { RoomGameSnapshot } from './RoomGameSnapshot';
import type { RoomPlayer } from './RoomPlayer';
import type { RoomPhase } from './RoomPhase';
import type { RoomReadyPhase } from './RoomReadyPhase';
import type { RoomSeat } from './RoomSeat';
import type { RoomStatus } from './RoomStatus';

export interface RoomSnapshot {
  readonly roomId: RoomId;
  readonly roomName: string;
  readonly hostProfileId: ProfileId;
  readonly gameId: RoomGameId;
  readonly gameTitle: string;
  readonly status: RoomStatus;
  readonly phase: RoomPhase;
  readonly sessionId: SessionId;
  readonly revision: number;
  readonly maxPlayers: number;
  readonly allowSpectators: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly players: readonly RoomPlayer[];
  readonly spectators: readonly RoomPlayer[];
  readonly seats: readonly RoomSeat[];
  readonly game: RoomGameSnapshot;
  readonly beat?:
    | {
        readonly rebetSeatIds: readonly HandId[];
        readonly readyProfileIds: readonly ProfileId[];
        readonly readyCount: number;
        readonly playerCount: number;
        readonly readyPhase?: RoomReadyPhase | undefined;
        readonly nextRoundDeadlineAt?: number | undefined;
        readonly nextRoundRemainingMs?: number | undefined;
      }
    | undefined;
  readonly slots?:
    | {
        readonly wager: number;
        readonly wagersByProfileId: Readonly<Record<ProfileId, number>>;
        readonly readyProfileIds: readonly ProfileId[];
        readonly lastSpinByProfileId?: ProfileId | undefined;
        readonly returnedByProfileId?: Readonly<Record<ProfileId, number>> | undefined;
      }
    | undefined;
}
