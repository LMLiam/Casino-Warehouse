import type { CasinoSaveState } from './CasinoSaveState';
import { parseCasinoSaveState } from './parseCasinoSaveState';

export const parseProfileStoreJson = (json: string): CasinoSaveState => parseCasinoSaveState(JSON.parse(json));
