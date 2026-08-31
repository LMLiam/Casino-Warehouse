import type { StorageLike } from '../profiles/StorageLike';
import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import { parseSessionState } from './parseSessionState';
import type { SessionLoadResult } from './SessionLoadResult';
import { sessionStorageKey } from './sessionStorageKey';

export const loadSessionState = (storage: StorageLike, key = sessionStorageKey): SessionLoadResult => {
  const recover = (message: string): SessionLoadResult => {
    try {
      storage.removeItem(key);
    } catch {
      // Preserve recovery when storage cleanup is unavailable.
    }
    return { recovered: true, error: message };
  };

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return { recovered: false };
    }

    const parsed = parseSessionState(parseJsonText(raw));
    if (!parsed.ok) {
      return recover(parsed.error.message);
    }
    return { session: parsed.value, recovered: false };
  } catch (error) {
    return recover(error instanceof Error ? error.message : 'Unknown session-data error.');
  }
};
