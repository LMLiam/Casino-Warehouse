import type { CasinoSaveState } from './CasinoSaveState';
import { createIsoTimestamp } from '../../schemas/casinoSchemas/createIsoTimestamp';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import { normalizeProfileName } from './normalizeProfileName';

export const renameProfile = (state: CasinoSaveState, profileId: ProfileId, name: string, now = new Date()): CasinoSaveState => ({
  ...state,
  profiles: state.profiles.map((profile) =>
    profile.id === profileId ? { ...profile, name: normalizeProfileName(name), updatedAt: createIsoTimestamp(now) } : profile,
  ),
});
