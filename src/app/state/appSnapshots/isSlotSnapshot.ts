import type { SlotSnapshot } from '../../../game/slots/SlotSnapshot';

export const isSlotSnapshot = (snapshot: unknown): snapshot is SlotSnapshot =>
  typeof snapshot === 'object' && snapshot !== null && 'reels' in snapshot && 'themeId' in snapshot && 'bonusPicksRemaining' in snapshot;
