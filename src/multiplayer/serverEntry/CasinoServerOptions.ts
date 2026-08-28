import type { ServerDataStore } from '../../state/serverDataStore/ServerDataStore';
import type { CasinoRoomAuthority } from './CasinoRoomAuthority';

export interface CasinoServerOptions {
  readonly distRoot?: string | undefined;
  readonly authority?: CasinoRoomAuthority | undefined;
  readonly dataStore?: ServerDataStore | undefined;
  readonly heartbeatIntervalMs?: number | undefined;
  readonly heartbeatTimeoutMs?: number | undefined;
  readonly adminToken?: string | undefined;
  readonly serverInstanceId?: string | undefined;
  readonly publicBaseUrl?: string | (() => string) | undefined;
  readonly publicWebSocketUrl?: string | (() => string) | undefined;
}
