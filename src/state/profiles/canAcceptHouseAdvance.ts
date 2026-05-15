import { houseAdvanceConfig } from './houseAdvanceConfig';
import type { CasinoProfile } from './CasinoProfile';

export const canAcceptHouseAdvance = (profile: Pick<CasinoProfile, 'bankroll' | 'houseAdvance'>): boolean => {
  const { bankroll, houseAdvance } = profile;
  return (
    bankroll === 0 &&
    houseAdvance.outstandingBalance < houseAdvanceConfig.amount * houseAdvanceConfig.maxActiveCount &&
    houseAdvance.activeCount < houseAdvanceConfig.maxActiveCount
  );
};
