import type { CasinoSaveState } from './CasinoSaveState';

export interface ProfileStoreResult {
  readonly state: CasinoSaveState;
  readonly recovered: boolean;
  readonly error?: string;
}
