import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';

export interface PlayerGameSnapshots {
  readonly beatTheHouse?: BeatTheHouseSaveState;
  readonly blackjack?: BlackjackSnapshot;
  readonly slots?: Readonly<Record<string, SlotSnapshot>>;
}
