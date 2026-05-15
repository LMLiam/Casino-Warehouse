import { houseAdvanceConfig } from './houseAdvanceConfig';
import type { CasinoProfile } from './CasinoProfile';

export const isHouseAdvanceCapped = (profile: Pick<CasinoProfile, 'bankroll' | 'houseAdvance'>): boolean => {
  const { bankroll, houseAdvance } = profile;
  return bankroll === 0 && houseAdvance.outstandingBalance > 0 && houseAdvance.activeCount >= houseAdvanceConfig.maxActiveCount;
};
