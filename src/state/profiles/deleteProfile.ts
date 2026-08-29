import type { CasinoSaveState } from './CasinoSaveState';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';

export const deleteProfile = (state: CasinoSaveState, profileId: ProfileId): CasinoSaveState => ({
  ...state,
  profiles: state.profiles.filter((profile) => profile.id !== profileId),
});
