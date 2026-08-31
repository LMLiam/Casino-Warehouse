import type { RoomGameSnapshot } from '../../../multiplayer/protocol/RoomGameSnapshot';
import type { SlotSnapshot } from '../../../game/slots/SlotSnapshot';

export const isSlotSnapshot = (snapshot: RoomGameSnapshot): snapshot is SlotSnapshot =>
  'reels' in snapshot && 'themeId' in snapshot && 'bonusPicksRemaining' in snapshot;
