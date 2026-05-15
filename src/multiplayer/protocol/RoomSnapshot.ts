import type { HandId } from '../../game/types/HandId';
import type { RoomGameId } from './RoomGameId';
import type { RoomGameSnapshot } from './RoomGameSnapshot';
import type { RoomPlayer } from './RoomPlayer';
import type { RoomSeat } from './RoomSeat';
import type { RoomStatus } from './RoomStatus';

export interface RoomSnapshot {
  readonly roomId: string;
  readonly roomName: string;
  readonly hostProfileId: string;
  readonly gameId: RoomGameId;
  readonly gameTitle: string;
  readonly status: RoomStatus;
  readonly phase: 'lobby' | 'betting' | 'playing' | 'settled';
  readonly sessionId: string;
  readonly revision: number;
  readonly maxPlayers: number;
  readonly allowSpectators: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly players: readonly RoomPlayer[];
  readonly spectators: readonly RoomPlayer[];
  readonly seats: readonly RoomSeat[];
  readonly game: RoomGameSnapshot;
  readonly beat?: {
    readonly rebetSeatIds: readonly HandId[];
    readonly readyProfileIds: readonly string[];
    readonly readyCount: number;
    readonly playerCount: number;
    readonly readyPhase?: 'betting' | 'roundOver';
    readonly nextRoundDeadlineAt?: number;
    readonly nextRoundRemainingMs?: number;
  };
  readonly slots?: {
    readonly wager: number;
    readonly wagersByProfileId: Readonly<Record<string, number>>;
    readonly readyProfileIds: readonly string[];
    readonly lastSpinByProfileId?: string;
    readonly returnedByProfileId?: Readonly<Record<string, number>>;
  };
}
