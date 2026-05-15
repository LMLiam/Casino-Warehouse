import type { RoomSeatId } from './RoomSeatId';

export interface RoomSettlement {
  readonly id: string;
  readonly kind?: 'gameplay' | 'dealer-thanks';
  readonly profileId: string;
  readonly seatId: RoomSeatId;
  readonly wagered: number;
  readonly returned: number;
  readonly profit: number;
  readonly dealerTip?: number;
  readonly dealerThanks?: number;
  readonly houseAdvanceRepayment?: number;
}
