import type { CasinoProfile } from './CasinoProfile';
import type { currentProfileStoreVersion } from './currentProfileStoreVersion';

export interface CasinoSaveState {
  readonly version: typeof currentProfileStoreVersion;
  readonly profiles: readonly CasinoProfile[];
}
