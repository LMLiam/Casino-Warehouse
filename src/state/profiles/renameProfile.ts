import type { CasinoSaveState } from './CasinoSaveState';
import { normalizeProfileName } from './normalizeProfileName';

export const renameProfile = (state: CasinoSaveState, profileId: string, name: string, now = new Date()): CasinoSaveState => ({
  ...state,
  profiles: state.profiles.map((profile) =>
    profile.id === profileId ? { ...profile, name: normalizeProfileName(name), updatedAt: now.toISOString() } : profile,
  ),
});
