import type { CasinoProfile } from '../profiles/CasinoProfile';

export interface GameplaySettlementResult {
  readonly profile: CasinoProfile;
  readonly houseAdvanceRepayment: number;
}
