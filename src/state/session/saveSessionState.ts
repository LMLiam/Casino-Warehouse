import type { StorageLike } from '../profiles/StorageLike';
import type { CasinoSessionState } from './CasinoSessionState';
import { parseSessionState } from './parseSessionState';
import { sessionStorageKey } from './sessionStorageKey';

export const saveSessionState = (storage: StorageLike, session: CasinoSessionState, key = sessionStorageKey): void => {
  const parsed = parseSessionState(session);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  storage.setItem(key, JSON.stringify(parsed.value));
};
