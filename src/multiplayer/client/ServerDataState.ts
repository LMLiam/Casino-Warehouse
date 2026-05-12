import type { CasinoSaveState } from '../../state/profiles/CasinoSaveState';
import type { CasinoSessionState } from '../../state/session/CasinoSessionState';
import type { ServerDatabaseChoice } from '../../state/serverDataStore/ServerDatabaseChoice';

export interface ServerDataState {
  readonly database: ServerDatabaseChoice;
  readonly profileState: CasinoSaveState;
  readonly session?: CasinoSessionState;
}
