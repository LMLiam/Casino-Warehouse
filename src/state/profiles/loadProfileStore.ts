import { emptySaveState } from './emptySaveState';
import { parseProfileStoreJson } from './parseProfileStoreJson';
import { profileStorageKey } from './profileStorageKey';
import type { ProfileStoreResult } from './ProfileStoreResult';
import type { StorageLike } from './StorageLike';

export const loadProfileStore = (storage: StorageLike, key = profileStorageKey): ProfileStoreResult => {
  const recover = (message: string): ProfileStoreResult => {
    try {
      storage.removeItem(key);
    } catch {
      // Preserve recovery when storage cleanup is unavailable.
    }
    return { state: emptySaveState(), recovered: true, error: message };
  };

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return { state: emptySaveState(), recovered: false };
    }

    const parsed = parseProfileStoreJson(raw);
    if (!parsed.ok) {
      return recover(parsed.error.message);
    }
    return { state: parsed.value, recovered: false };
  } catch (error) {
    return recover(error instanceof Error ? error.message : 'Unknown save-data error.');
  }
};
