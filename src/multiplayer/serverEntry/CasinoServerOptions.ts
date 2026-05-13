import type { ServerDataStore } from '../../state/serverDataStore/ServerDataStore';
import type { CasinoRoomAuthority } from './CasinoRoomAuthority';

export interface CasinoServerOptions {
  readonly distRoot?: string;
  readonly authority?: CasinoRoomAuthority;
  readonly dataStore?: ServerDataStore;
  readonly heartbeatIntervalMs?: number;
  readonly heartbeatTimeoutMs?: number;
  readonly adminToken?: string;
  readonly serverInstanceId?: string;
  readonly publicBaseUrl?: string;
}
