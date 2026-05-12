import type { CasinoSaveState } from './CasinoSaveState';

export const deleteProfile = (state: CasinoSaveState, profileId: string): CasinoSaveState => ({
  ...state,
  profiles: state.profiles.filter((profile) => profile.id !== profileId),
});
