import type { SlotSnapshot } from '../../../game/slots/SlotSnapshot';
import type { RoomGameSnapshot } from '../../../multiplayer/protocol/RoomGameSnapshot';

export const isSlotSnapshot = (snapshot: RoomGameSnapshot | null): snapshot is SlotSnapshot =>
  snapshot !== null && 'reels' in snapshot && 'themeId' in snapshot && 'bonusPicksRemaining' in snapshot;
