import type { CasinoGameId } from '../../game/ids';

type SessionRoomSeatId = 'left' | 'centre' | 'right' | `seat-${number}`;

export interface CasinoSessionRoomState {
  readonly roomId: string;
  readonly gameId: CasinoGameId;
  readonly role: 'player' | 'spectator';
  readonly seatId?: SessionRoomSeatId;
}
