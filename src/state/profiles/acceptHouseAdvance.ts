import { advanceHouseAdvanceState } from './advanceHouseAdvanceState';
import { canAcceptHouseAdvance } from './canAcceptHouseAdvance';
import type { CasinoProfile } from './CasinoProfile';
import { houseAdvanceConfig } from './houseAdvanceConfig';
import { recordTransaction } from './recordTransaction';

export const acceptHouseAdvance = (profile: CasinoProfile, now = new Date()): CasinoProfile | undefined =>
  canAcceptHouseAdvance(profile)
    ? recordTransaction(
        { ...profile, houseAdvance: advanceHouseAdvanceState(profile.houseAdvance) },
        {
          gameId: 'house-advance',
          type: 'house_advance_credit',
          amount: houseAdvanceConfig.amount,
          description: 'House Advance accepted.',
          metadata: {
            outstandingBalance: profile.houseAdvance.outstandingBalance + houseAdvanceConfig.amount,
            activeCount: profile.houseAdvance.activeCount + 1,
          },
        },
        now,
      )
    : undefined;
