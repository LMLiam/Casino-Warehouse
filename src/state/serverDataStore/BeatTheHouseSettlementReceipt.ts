import type { IsoTimestamp } from '../../schemas/casinoSchemas/IsoTimestamp';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { SessionId } from '../../schemas/casinoSchemas/SessionId';
import type { HouseAdvanceState } from '../profiles/HouseAdvanceState';

export interface BeatTheHouseSettlementReceipt {
  readonly settlementKey: string;
  readonly profileId: ProfileId;
  readonly profileCreatedAt: IsoTimestamp;
  readonly gameId: 'beat-the-house';
  readonly roomId?: RoomId | undefined;
  readonly sessionId?: SessionId | undefined;
  readonly returnedHalfUnits: number;
  readonly profitHalfUnits: number;
  readonly halfChipBefore: 0 | 1;
  readonly halfChipAfter: 0 | 1;
  readonly wholeCreditsReleased: number;
  readonly houseAdvanceRepayment: number;
  readonly bankrollAfter: number;
  readonly houseAdvanceAfter: HouseAdvanceState;
}
