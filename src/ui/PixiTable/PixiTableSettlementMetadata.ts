import type { HandId } from '../../game/types/HandId';

export interface PixiTableSettlementMetadata {
  readonly handId: HandId;
  readonly houseAdvanceRepayment?: number;
}
