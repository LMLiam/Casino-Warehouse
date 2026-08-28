import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';

export interface PlayerGameSnapshots {
  readonly beatTheHouse?: BeatTheHouseSaveState | undefined;
  readonly blackjack?: BlackjackSnapshot | undefined;
  readonly slots?: Readonly<Record<string, SlotSnapshot>> | undefined;
}
