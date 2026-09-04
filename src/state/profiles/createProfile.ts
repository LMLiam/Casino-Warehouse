import type { CasinoProfile } from './CasinoProfile';
import type { CasinoSaveState } from './CasinoSaveState';
import { createIsoTimestamp } from '../../schemas/casinoSchemas/createIsoTimestamp';
import { profileIdSchema } from '../../schemas/casinoSchemas/profileIdSchema';
import { createStateId } from './createStateId';
import { defaultGameCredits } from './defaultGameCredits';
import { defaultHouseAdvanceState } from './defaultHouseAdvanceState';
import { emptyStats } from './emptyStats';
import { normalizeProfileName } from './normalizeProfileName';
import { profileColorFromName } from './profileColorFromName';
import type { StateIdGenerator } from './StateIdGenerator';

export const createProfile = (
  state: CasinoSaveState,
  name: string,
  bankroll = 1000,
  now = new Date(),
  idGenerator: StateIdGenerator = createStateId,
): CasinoSaveState => {
  const profileName = normalizeProfileName(name);
  const at = createIsoTimestamp(now);
  const profile: CasinoProfile = {
    id: profileIdSchema.parse(idGenerator('profile', now)),
    name: profileName,
    color: profileColorFromName(profileName),
    bankroll: Math.max(0, Math.floor(bankroll)),
    gameCredits: defaultGameCredits,
    houseAdvance: defaultHouseAdvanceState,
    stats: emptyStats(),
    transactions: [],
    createdAt: at,
    updatedAt: at,
  };

  return { ...state, profiles: [...state.profiles, profile] };
};
