import type { CasinoSaveState } from './CasinoSaveState';
import { currentProfileStoreVersion } from './currentProfileStoreVersion';

export const emptySaveState = (): CasinoSaveState => ({
  version: currentProfileStoreVersion,
  profiles: [],
});
