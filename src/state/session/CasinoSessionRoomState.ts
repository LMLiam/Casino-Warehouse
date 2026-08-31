import type { CasinoGameId } from '../../game/ids';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { RoomSeatId } from '../../multiplayer/protocol/RoomSeatId';

export interface CasinoSessionRoomState {
  readonly roomId: RoomId;
  readonly gameId: CasinoGameId;
  readonly role: 'player' | 'spectator';
  readonly seatId?: RoomSeatId | undefined;
}
