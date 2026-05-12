import type { CasinoGameId } from '../../game/ids';
import type { CasinoSessionRoomState } from './CasinoSessionRoomState';
import type { PlayerGameSnapshots } from './PlayerGameSnapshots';

export interface CasinoSessionState {
  readonly version: 1;
  readonly profileIds: readonly string[];
  readonly selectedPlayerIndex: number;
  readonly activeGame: CasinoGameId;
  readonly showingGameLobby: boolean;
  readonly wagerLimit: number;
  readonly wagered: number;
  readonly gameSnapshots: Readonly<Record<string, PlayerGameSnapshots>>;
  readonly room?: CasinoSessionRoomState;
  readonly updatedAt: string;
}
