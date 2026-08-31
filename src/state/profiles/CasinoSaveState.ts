import type { CasinoProfile } from './CasinoProfile';

export interface CasinoSaveState {
  readonly profiles: readonly CasinoProfile[];
}
