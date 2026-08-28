import type { CasinoGameId } from '../../game/ids';
import type { SessionRoomSeatId } from './SessionRoomSeatId';

export interface CasinoSessionRoomState {
  readonly roomId: string;
  readonly gameId: CasinoGameId;
  readonly role: 'player' | 'spectator';
  readonly seatId?: SessionRoomSeatId | undefined;
}
