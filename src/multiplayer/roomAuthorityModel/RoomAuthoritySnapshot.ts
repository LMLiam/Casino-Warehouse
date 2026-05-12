import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import type { GameSnapshot } from '../../game/types/GameSnapshot';

export type RoomAuthoritySnapshot = GameSnapshot | BlackjackSnapshot | SlotSnapshot;
