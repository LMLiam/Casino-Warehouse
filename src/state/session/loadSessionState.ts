import type { StorageLike } from '../profiles/StorageLike';
import { parseSessionState } from './parseSessionState';
import type { SessionLoadResult } from './SessionLoadResult';
import { sessionStorageKey } from './sessionStorageKey';

export const loadSessionState = (storage: StorageLike, key = sessionStorageKey): SessionLoadResult => {
  const raw = storage.getItem(key);
  if (!raw) {
    return { recovered: false };
  }

  try {
    return { session: parseSessionState(JSON.parse(raw)), recovered: false };
  } catch (error) {
    return {
      recovered: true,
      error: error instanceof Error ? error.message : 'Unknown session-data error.',
    };
  }
};
