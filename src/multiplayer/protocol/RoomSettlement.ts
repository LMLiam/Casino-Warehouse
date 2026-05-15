import type { RoomSeatId } from './RoomSeatId';

export interface RoomSettlement {
  readonly id: string;
  readonly profileId: string;
  readonly seatId: RoomSeatId;
  readonly wagered: number;
  readonly returned: number;
  readonly profit: number;
  readonly houseAdvanceRepayment?: number;
}
