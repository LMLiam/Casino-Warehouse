import type { HalfUnits } from '../../game/beatTheHouse/HalfUnits';
import type { CasinoProfile } from '../profiles/CasinoProfile';

export interface BeatTheHouseSettlementResult {
  readonly profile: CasinoProfile;
  readonly returnedHalfUnits: HalfUnits;
  readonly profitHalfUnits: HalfUnits;
  readonly halfChipBefore: 0 | 1;
  readonly halfChipAfter: 0 | 1;
  readonly wholeCreditsReleased: number;
  readonly houseAdvanceRepayment: number;
  readonly alreadyApplied: boolean;
}
