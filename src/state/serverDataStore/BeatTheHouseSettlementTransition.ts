import type { CasinoProfile } from '../profiles/CasinoProfile';
import type { BeatTheHouseSettlementReceipt } from './BeatTheHouseSettlementReceipt';

export interface BeatTheHouseSettlementTransition {
  readonly profile: CasinoProfile;
  readonly receipt: BeatTheHouseSettlementReceipt;
}
