import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import type { CasinoSessionRoomState } from './CasinoSessionRoomState';
import type { BeatTheHouseSaveStateV3 } from './BeatTheHouseSaveStateV3';

export interface SessionStateInput {
  readonly version?: number;
  readonly profileIds?: readonly string[];
  readonly profileId?: string;
  readonly activeGame?: string;
  readonly showingGameLobby?: boolean | string | number | null;
  readonly wagerLimit?: number | string | null;
  readonly wagered?: number | string | null;
  readonly gameSnapshot?: {
    readonly beatTheHouse?: Partial<BeatTheHouseSaveState> | Partial<BeatTheHouseSaveStateV3> | null;
    readonly blackjack?: Partial<BlackjackSnapshot> | null;
    readonly slots?: Readonly<Record<string, Partial<SlotSnapshot> | null>> | null;
  } | null;
  readonly room?:
    | {
        readonly roomId?: string;
        readonly gameId?: string;
        readonly role?: string;
        readonly seatId?: string | null;
      }
    | CasinoSessionRoomState
    | null;
  readonly updatedAt?: string | null;
}
