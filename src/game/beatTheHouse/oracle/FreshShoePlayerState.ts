import type { FreshShoeCounts } from './FreshShoeCounts';

export type FreshShoePlayerState = {
  readonly counts: FreshShoeCounts;
  readonly playerFirstKind: number;
  readonly playerFinalKind: number;
  readonly playerCardCount: number;
};
