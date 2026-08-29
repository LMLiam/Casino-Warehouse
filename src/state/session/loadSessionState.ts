import type { StorageLike } from '../profiles/StorageLike';
import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import { parseSessionState } from './parseSessionState';
import type { SessionLoadResult } from './SessionLoadResult';
import { sessionStorageKey } from './sessionStorageKey';

export const loadSessionState = (storage: StorageLike, key = sessionStorageKey): SessionLoadResult => {
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return { recovered: false };
    }

    const parsed = parseSessionState(parseJsonText(raw));
    if (!parsed.ok) {
      return { recovered: true, error: parsed.error.message };
    }
    return { session: parsed.value, recovered: false };
  } catch (error) {
    return {
      recovered: true,
      error: error instanceof Error ? error.message : 'Unknown session-data error.',
    };
  }
};
