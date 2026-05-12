import type { RoomSeatId } from './RoomSeatId';

export interface RoomSeat {
  readonly seatId: RoomSeatId;
  readonly profileId?: string;
}
