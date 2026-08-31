import type { SettlementId } from '../../schemas/casinoSchemas/SettlementId';
import type { RoomSeatId } from './RoomSeatId';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';

export interface RoomSettlement {
  readonly id: SettlementId;
  readonly kind?: 'gameplay' | 'dealer-thanks' | undefined;
  readonly profileId: ProfileId;
  readonly seatId: RoomSeatId;
  readonly wagered: number;
  readonly returned: number;
  readonly profit: number;
  readonly dealerTip?: number | undefined;
  readonly dealerThanks?: number | undefined;
  readonly houseAdvanceRepayment?: number | undefined;
}
