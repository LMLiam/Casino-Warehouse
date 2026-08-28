import type { CasinoGameId } from '../../game/ids';
import type { CasinoSessionRoomState } from './CasinoSessionRoomState';
import type { PlayerGameSnapshots } from './PlayerGameSnapshots';

export interface CasinoSessionState {
  readonly profileId: string;
  readonly activeGame: CasinoGameId;
  readonly showingGameLobby: boolean;
  readonly wagerLimit: number;
  readonly wagered: number;
  readonly gameSnapshot?: PlayerGameSnapshots;
  readonly room?: CasinoSessionRoomState;
  readonly updatedAt: string;
}
