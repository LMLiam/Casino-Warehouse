import type { CasinoSaveState } from './CasinoSaveState';
import { parseCasinoSaveState } from './parseCasinoSaveState';
import { profileStorageKey } from './profileStorageKey';
import type { StorageLike } from './StorageLike';

export const saveProfileStore = (storage: StorageLike, state: CasinoSaveState, key = profileStorageKey): void => {
  const parsed = parseCasinoSaveState(state);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  storage.setItem(key, JSON.stringify(parsed.value));
};
