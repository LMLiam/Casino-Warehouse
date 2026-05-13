import { createMemoryServerDataStore } from './createMemoryServerDataStore';
import { defaultSqlitePath } from './defaultSqlitePath';
import type { ServerDataStore } from './ServerDataStore';
import { SqliteServerDataStore } from './SqliteServerDataStore';

export const createDefaultServerDataStore = (): ServerDataStore => {
  if (process.env.NODE_ENV === 'test') {
    return createMemoryServerDataStore();
  }
  return new SqliteServerDataStore(process.env.CASINO_DB_PATH || defaultSqlitePath());
};
