import { emptySaveState } from './emptySaveState';
import { parseCasinoSaveState } from './parseCasinoSaveState';
import { profileStorageKey } from './profileStorageKey';
import type { ProfileStoreResult } from './ProfileStoreResult';
import type { StorageLike } from './StorageLike';

export const loadProfileStore = (storage: StorageLike, key = profileStorageKey): ProfileStoreResult => {
  const raw = storage.getItem(key);
  if (!raw) {
    return { state: emptySaveState(), recovered: false };
  }

  try {
    return { state: parseCasinoSaveState(JSON.parse(raw)), recovered: false };
  } catch (error) {
    return {
      state: emptySaveState(),
      recovered: true,
      error: error instanceof Error ? error.message : 'Unknown save-data error.',
    };
  }
};
