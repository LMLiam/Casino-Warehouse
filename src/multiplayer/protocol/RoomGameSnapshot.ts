import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import type { BlackjackTableSnapshot } from '../../game/blackjackTable/BlackjackTableSnapshot';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import type { GameSnapshot } from '../../game/types/GameSnapshot';

export type RoomGameSnapshot = GameSnapshot | BlackjackSnapshot | BlackjackTableSnapshot | SlotSnapshot;
