import type { CasinoProfile } from './CasinoProfile';
import type { CasinoSaveState } from './CasinoSaveState';
import { parseCasinoProfile } from './parseCasinoProfile';

export const replaceProfile = (state: CasinoSaveState, updated: CasinoProfile): CasinoSaveState => ({
  ...state,
  profiles: state.profiles.map((profile) => (profile.id === updated.id ? parseCasinoProfile(updated) : profile)),
});
