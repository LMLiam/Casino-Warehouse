import type { CasinoSaveState } from './CasinoSaveState';
import { parseCasinoSaveState } from './parseCasinoSaveState';
import { profileStorageKey } from './profileStorageKey';
import type { StorageLike } from './StorageLike';

export const saveProfileStore = (storage: StorageLike, state: CasinoSaveState, key = profileStorageKey): void => {
  storage.setItem(key, JSON.stringify(parseCasinoSaveState(state)));
};
