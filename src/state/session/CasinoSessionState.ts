import type { IsoTimestamp } from '../../schemas/casinoSchemas/IsoTimestamp';
import type { CasinoGameId } from '../../game/ids';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { CasinoSessionRoomState } from './CasinoSessionRoomState';
import type { PlayerGameSnapshots } from './PlayerGameSnapshots';

export interface CasinoSessionState {
  readonly profileId: ProfileId;
  readonly activeGame: CasinoGameId;
  readonly showingGameLobby: boolean;
  readonly wagerLimit: number;
  readonly wagered: number;
  readonly gameSnapshot?: PlayerGameSnapshots | undefined;
  readonly room?: CasinoSessionRoomState | undefined;
  readonly updatedAt: IsoTimestamp;
}
