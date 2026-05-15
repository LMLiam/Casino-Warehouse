import type { CasinoGameId } from '../../game/ids';
import type { CasinoSessionRoomState } from './CasinoSessionRoomState';
import type { currentSessionStateVersion } from './currentSessionStateVersion';
import type { PlayerGameSnapshots } from './PlayerGameSnapshots';

export interface CasinoSessionState {
  readonly version: typeof currentSessionStateVersion;
  readonly profileId: string;
  readonly activeGame: CasinoGameId;
  readonly showingGameLobby: boolean;
  readonly wagerLimit: number;
  readonly wagered: number;
  readonly gameSnapshot?: PlayerGameSnapshots;
  readonly room?: CasinoSessionRoomState;
  readonly updatedAt: string;
}
