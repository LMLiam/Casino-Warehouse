import type { CasinoSaveState } from './CasinoSaveState';

export const emptySaveState = (): CasinoSaveState => ({
  version: 1,
  profiles: [],
});
