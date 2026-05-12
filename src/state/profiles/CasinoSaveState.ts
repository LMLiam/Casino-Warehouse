import type { CasinoProfile } from './CasinoProfile';

export interface CasinoSaveState {
  readonly version: 1;
  readonly profiles: readonly CasinoProfile[];
}
