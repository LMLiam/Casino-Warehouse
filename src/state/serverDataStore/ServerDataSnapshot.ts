import type { CasinoSaveState } from '../profiles/CasinoSaveState';
import type { CasinoSessionState } from '../session/CasinoSessionState';
import type { ServerDatabaseChoice } from './ServerDatabaseChoice';

export interface ServerDataSnapshot {
  readonly database: ServerDatabaseChoice;
  readonly profileState: CasinoSaveState;
  readonly session?: CasinoSessionState | undefined;
}
