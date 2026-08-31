import type { RoomSeatId } from './RoomSeatId';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';

export interface RoomSeat {
  readonly seatId: RoomSeatId;
  readonly profileId?: ProfileId | undefined;
}
